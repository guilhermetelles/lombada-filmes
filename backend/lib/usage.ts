import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firestore.js';

export type Source = 'tmdb' | 'omdb' | 'letterboxd';
export type Outcome = 'calls' | 'errors' | 'cacheHits';

// Cota diária documentada, gravada junto com o consumo para a tela de consumo das APIs.
const DAILY_LIMIT: Partial<Record<Source, number>> = { omdb: 1000 };

// Dia no fuso de São Paulo (yyyy-mm-dd), que é o id do documento em usage/.
export function usageDay(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(date);
}

export async function recordUsage(source: Source, outcome: Outcome, date = new Date()): Promise<void> {
  const counters: Record<string, unknown> = { [outcome]: FieldValue.increment(1) };
  const limit = DAILY_LIMIT[source];
  if (limit) counters.dailyLimit = limit;
  await db().doc(`usage/${usageDay(date)}`).set({ [source]: counters }, { merge: true });
}

// Faz uma chamada externa contando o pedido; se ela falhar, conta também o erro e repassa a falha.
export async function tracked<T>(source: Source, call: () => Promise<T>): Promise<T> {
  await recordUsage(source, 'calls');
  try {
    return await call();
  } catch (err) {
    await recordUsage(source, 'errors');
    throw err;
  }
}
