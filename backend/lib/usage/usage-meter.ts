import { FieldValue, type Firestore, Timestamp } from 'firebase-admin/firestore';
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

/** Onde ler os prazos já gravados dos modelos do Gemini sem cota, e o relógio. */
type UsageStore = { db: Firestore; now: () => Date };

/** Documento com até quando pular cada modelo do Gemini (`skipUntil.{modelo}`). Só o backend lê. */
export const GEMINI_QUOTA_DOC = 'quotas/gemini';

/**
 * Conta o consumo das fontes durante um pedido e grava tudo no fim, numa gravação só. Também conta
 * os pedidos a cada modelo do Gemini (`geminiModels.{modelo}.{calls,errors,quota}`) e lembra até
 * quando pular os modelos que responderam 429 (em quotas/gemini, que atravessa a virada do dia),
 * para o cliente do Gemini ir direto ao próximo.
 */
export class UsageMeter implements UsageRecorder {
  readonly #counts = new Map<SourceName, Map<UsageOutcome, number>>();
  readonly #models = new Map<string, Map<GeminiModelOutcome, number>>();
  readonly #quotaHits = new Set<string>();
  readonly #skips = new Map<string, Date>();
  readonly #store: UsageStore | undefined;
  #storedSkips: Promise<ReadonlyMap<string, Date>> | undefined;

  /**
   * @param store - Banco e relógio para ler os prazos já gravados; sem ele, só vale o que esta
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
   * Soma 1 a um contador de um modelo do Gemini. `quota` conta os 429.
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
   * Pula um modelo do Gemini até o momento dado; o prazo mais longo vale.
   *
   * @param model - Versão do modelo.
   * @param until - Quando o modelo pode ser tentado de novo.
   */
  skipGeminiModel(model: string, until: Date): void {
    const current = this.#skips.get(model);
    if (!current || until > current) this.#skips.set(model, until);
  }

  /**
   * Modelos do Gemini a pular agora: os prazos gravados em quotas/gemini (lidos uma vez por
   * execução) e os desta execução que ainda não passaram. Uma falha ao ler vai para o log e conta
   * como nenhum.
   *
   * @returns Os modelos ainda no prazo.
   */
  async geminiModelsToSkip(): Promise<ReadonlySet<string>> {
    this.#storedSkips ??= this.#readStoredSkips();
    const now = this.#store?.now() ?? new Date();
    const all = [...(await this.#storedSkips), ...this.#skips];
    return new Set(all.flatMap(([model, until]) => (until > now ? [model] : [])));
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
    const skips = new Map(this.#skips);
    this.#skips.clear();
    if (skips.size > 0) {
      // Com set() e merge, as chaves dos mapas são nomes de campo: o ponto de "gemini-3.8-flash" não
      // vira caminho.
      const skipUntil = Object.fromEntries([...skips].map(([model, until]) => [model, Timestamp.fromDate(until)]));
      await db.doc(GEMINI_QUOTA_DOC).set({ skipUntil }, { merge: true });
    }
    if (this.#counts.size === 0 && this.#models.size === 0) return;
    const increments = this.#toIncrements();
    this.#counts.clear();
    this.#models.clear();
    await db.doc(`usage/${usageDay(now)}`).set(increments, { merge: true });
  }

  /**
   * Lê quotas/gemini e devolve o prazo gravado de cada modelo.
   *
   * @returns Até quando pular cada modelo, segundo o que já foi gravado.
   */
  async #readStoredSkips(): Promise<ReadonlyMap<string, Date>> {
    if (!this.#store) return new Map();
    try {
      const skipUntil: unknown = (await this.#store.db.doc(GEMINI_QUOTA_DOC).get()).get('skipUntil');
      if (typeof skipUntil !== 'object' || skipUntil === null) return new Map();
      return new Map(
        Object.entries(skipUntil).flatMap(([model, until]) =>
          until instanceof Timestamp ? [[model, until.toDate()]] : [],
        ),
      );
    } catch (error) {
      logger.warn('prazos dos modelos do Gemini não lidos; todos os modelos ficam disponíveis', { error });
      return new Map();
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
