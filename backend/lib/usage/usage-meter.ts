import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { SourceName } from '../types/sources.js';
import type { UsageOutcome, UsageRecorder } from '../types/usage.js';
import { usageDay } from './usage-day.js';

/** Cota diária documentada de cada fonte, gravada junto com o consumo para a tela de consumo. */
const DAILY_LIMITS: Partial<Record<SourceName, number>> = { omdb: 1000 };

type SourceIncrements = Partial<Record<UsageOutcome, FieldValue>> & { dailyLimit?: number };

/** Conta o consumo das fontes durante um pedido e grava tudo no fim, numa gravação só. */
export class UsageMeter implements UsageRecorder {
  readonly #counts = new Map<SourceName, Map<UsageOutcome, number>>();

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
   * Soma os contadores em usage/{dia} numa gravação só e zera o medidor. Não grava nada se nada foi
   * contado.
   *
   * @param db - Firestore.
   * @param now - Momento que define o dia.
   */
  async save(db: Firestore, now: Date): Promise<void> {
    if (this.#counts.size === 0) return;
    const increments = this.#toIncrements();
    this.#counts.clear();
    await db.doc(`usage/${usageDay(now)}`).set(increments, { merge: true });
  }

  /**
   * Converte os contadores em incrementos do Firestore, com a cota diária das fontes que têm uma.
   *
   * @returns Campos a gravar, agrupados por fonte.
   */
  #toIncrements(): Partial<Record<SourceName, SourceIncrements>> {
    const bySource: Partial<Record<SourceName, SourceIncrements>> = {};
    for (const [source, outcomes] of this.#counts) {
      const fields: SourceIncrements = {};
      for (const [outcome, amount] of outcomes) fields[outcome] = FieldValue.increment(amount);
      const dailyLimit = DAILY_LIMITS[source];
      if (dailyLimit !== undefined) fields.dailyLimit = dailyLimit;
      bySource[source] = fields;
    }
    return bySource;
  }
}
