import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { logger } from '../logging/logger.js';
import type { SourceName } from '../types/sources.js';
import type { GeminiModelOutcome, UsageOutcome, UsageRecorder } from '../types/usage.js';
import { usageDay } from './usage-day.js';

/** Cota diária documentada de cada fonte, gravada junto com o consumo para a tela de consumo. */
const DAILY_LIMITS: Partial<Record<SourceName, number>> = { omdb: 1000 };

/** Incrementos de uma fonte em usage/{dia}, com a cota diária quando houver. */
type SourceIncrements = Partial<Record<UsageOutcome, FieldValue>> & { dailyLimit?: number };

/** Campos gravados em usage/{dia}: um mapa por fonte e, se houve Gemini, um por modelo. */
type UsageIncrements = Partial<Record<SourceName, SourceIncrements>> & {
  geminiModels?: Record<string, Partial<Record<GeminiModelOutcome, FieldValue>>>;
};

/** Onde ler o consumo já gravado hoje (para saber que modelos do Gemini ficaram sem cota). */
type UsageStore = { db: Firestore; now: () => Date };

/**
 * Conta o consumo das fontes durante um pedido e grava tudo no fim, numa gravação só. Também conta
 * os pedidos a cada modelo do Gemini (`geminiModels.{modelo}.{calls,errors,quota}`) e lembra que
 * modelos responderam 429 hoje, para o cliente do Gemini pular direto para o próximo.
 */
export class UsageMeter implements UsageRecorder {
  readonly #counts = new Map<SourceName, Map<UsageOutcome, number>>();
  readonly #models = new Map<string, Map<GeminiModelOutcome, number>>();
  readonly #quotaHits = new Set<string>();
  readonly #store: UsageStore | undefined;
  #storedOutOfQuota: Promise<ReadonlySet<string>> | undefined;

  /**
   * @param store - Banco e relógio para ler o que já foi gravado hoje; sem ele, só vale o que esta
   *   execução viu.
   */
  constructor(store?: UsageStore) {
    this.#store = store;
  }

  /**
   * Soma 1 a um contador da fonte.
   *
   * @param source - Fonte externa.
   * @param outcome - Contador: pedido, erro ou acerto de cache.
   */
  count(source: SourceName, outcome: UsageOutcome): void {
    const outcomes = this.#counts.get(source) ?? new Map<UsageOutcome, number>();
    outcomes.set(outcome, (outcomes.get(outcome) ?? 0) + 1);
    this.#counts.set(source, outcomes);
  }

  /**
   * Faz uma chamada a uma fonte contando o pedido. Se ela falhar, conta também o erro.
   *
   * @param source - Fonte chamada.
   * @param call - Chamada à fonte.
   * @returns O que a chamada devolveu.
   * @throws O mesmo erro da chamada, repassado depois de contado.
   */
  async track<T>(source: SourceName, call: () => Promise<T>): Promise<T> {
    this.count(source, 'calls');
    try {
      return await call();
    } catch (error) {
      this.count(source, 'errors');
      throw error;
    }
  }

  /**
   * Soma 1 a um contador de um modelo do Gemini. `quota` marca o modelo como sem cota hoje.
   *
   * @param model - Versão do modelo (ex.: gemini-3.8-flash).
   * @param outcome - Pedido, erro ou cota esgotada (429).
   */
  countGeminiModel(model: string, outcome: GeminiModelOutcome): void {
    const outcomes = this.#models.get(model) ?? new Map<GeminiModelOutcome, number>();
    outcomes.set(outcome, (outcomes.get(outcome) ?? 0) + 1);
    this.#models.set(model, outcomes);
    if (outcome === 'quota') this.#quotaHits.add(model);
  }

  /**
   * Modelos do Gemini que responderam 429 hoje: os gravados em usage/{dia} (lidos uma vez por
   * execução) mais os desta execução. Uma falha ao ler vai para o log e conta como nenhum.
   *
   * @returns Os modelos sem cota hoje.
   */
  async geminiModelsOutOfQuota(): Promise<ReadonlySet<string>> {
    this.#storedOutOfQuota ??= this.#readStoredOutOfQuota();
    return new Set([...(await this.#storedOutOfQuota), ...this.#quotaHits]);
  }

  /**
   * Modelos do Gemini que responderam 429 nesta execução.
   *
   * @returns Os modelos, na ordem em que a cota acabou.
   */
  geminiQuotaHits(): string[] {
    return [...this.#quotaHits];
  }

  /**
   * Soma os contadores em usage/{dia} numa gravação só e zera o medidor. Não grava nada se nada foi
   * contado.
   *
   * @param db - Firestore.
   * @param now - Momento que define o dia.
   */
  async save(db: Firestore, now: Date): Promise<void> {
    if (this.#counts.size === 0 && this.#models.size === 0) return;
    const increments = this.#toIncrements();
    this.#counts.clear();
    this.#models.clear();
    // Com set() e merge, as chaves dos mapas são nomes de campo: o ponto de "gemini-3.8-flash" não
    // vira caminho.
    await db.doc(`usage/${usageDay(now)}`).set(increments, { merge: true });
  }

  /**
   * Lê usage/{dia} e devolve os modelos com `quota` maior que zero.
   *
   * @returns Os modelos sem cota hoje, segundo o que já foi gravado.
   */
  async #readStoredOutOfQuota(): Promise<ReadonlySet<string>> {
    if (!this.#store) return new Set();
    try {
      const { db, now } = this.#store;
      const models: unknown = (await db.doc(`usage/${usageDay(now())}`).get()).get('geminiModels');
      if (typeof models !== 'object' || models === null) return new Set();
      return new Set(
        Object.entries(models).flatMap(([model, counts]) =>
          typeof counts === 'object' && counts !== null && 'quota' in counts && Number(counts.quota) > 0 ? [model] : [],
        ),
      );
    } catch (error) {
      logger.warn('consumo do Gemini de hoje não lido; todos os modelos ficam disponíveis', { error });
      return new Set();
    }
  }

  /**
   * Converte os contadores em incrementos do Firestore, com a cota diária das fontes que têm uma.
   *
   * @returns Campos a gravar, agrupados por fonte e por modelo do Gemini.
   */
  #toIncrements(): UsageIncrements {
    const increments: UsageIncrements = {};
    for (const [source, outcomes] of this.#counts) {
      const fields: SourceIncrements = {};
      for (const [outcome, amount] of outcomes) fields[outcome] = FieldValue.increment(amount);
      const dailyLimit = DAILY_LIMITS[source];
      if (dailyLimit !== undefined) fields.dailyLimit = dailyLimit;
      increments[source] = fields;
    }
    if (this.#models.size > 0) {
      increments.geminiModels = Object.fromEntries(
        [...this.#models].map(([model, outcomes]) => [
          model,
          Object.fromEntries([...outcomes].map(([outcome, amount]) => [outcome, FieldValue.increment(amount)])),
        ]),
      );
    }
    return increments;
  }
}
