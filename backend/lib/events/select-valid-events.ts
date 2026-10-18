import type { RankedEntry } from './list-entries.js';

/** Quanto tempo depois da gravação uma entrada ainda vale como evento: 30 minutos. */
export const EVENT_FRESHNESS_MS = 30 * 60 * 1000;

/** O que aconteceu com a entrada: entrou na lista, mudou de posição ou ganhou comentário. */
export type ListEventType = 'added' | 'moved' | 'commented';

/** Um evento pedido pelo app: o tipo e a entrada. */
export type RequestedEvent = { type: ListEventType; entryId: string };

/** Um evento aceito, com a entrada lida do banco. */
export type ValidEvent = { type: ListEventType; entry: RankedEntry };

/**
 * Fica só com os eventos que o servidor confirma pelo banco: a entrada existe, foi gravada por
 * quem pede (`addedBy` para 'added', `updatedBy` para os outros) e `updatedAt` está nos últimos 30
 * minutos. Os outros são ignorados sem erro. Repetidos (mesmo tipo e entrada) contam uma vez,
 * na ordem do lote.
 *
 * @param requested - Eventos do pedido, na ordem em que aconteceram.
 * @param entries - Entradas da lista, lidas do banco.
 * @param uid - Quem pede.
 * @param now - Momento do pedido.
 * @returns Os eventos aceitos, com a entrada de cada um.
 */
function selectValidEvents(
  requested: readonly RequestedEvent[],
  entries: readonly RankedEntry[],
  uid: string,
  now: Date,
): ValidEvent[] {
  const byId = new Map(entries.map((entry) => [entry.entryId, entry]));
  const seen = new Set<string>();
  const valid: ValidEvent[] = [];

  for (const { type, entryId } of requested) {
    const key = `${type}:${entryId}`;
    const entry = byId.get(entryId);
    if (seen.has(key) || !entry) continue;
    const author = type === 'added' ? entry.addedBy : entry.updatedBy;
    const age = now.getTime() - entry.updatedAt.getTime();
    if (author !== uid || age > EVENT_FRESHNESS_MS) continue;
    seen.add(key);
    valid.push({ type, entry });
  }
  return valid;
}

export { selectValidEvents };
