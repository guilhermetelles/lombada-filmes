import type { RankedEntry } from './list-entries.js';

/** Quanto tempo depois da gravação uma entrada ainda vale como evento: 30 minutos. */
export const EVENT_FRESHNESS_MS = 30 * 60 * 1000;

/** O que aconteceu com a entrada: entrou na lista, mudou de posição, ganhou comentário ou saiu. */
export type ListEventType = 'added' | 'moved' | 'commented' | 'removed';

/** Um evento pedido pelo app: o tipo, a entrada e, para 'removed', o filme que saiu. */
export type RequestedEvent = { type: ListEventType; entryId: string; tmdbId?: number | null | undefined };

/** Um evento aceito de entrada que ainda existe, com a entrada lida do banco. */
export type EntryEvent = { type: Exclude<ListEventType, 'removed'>; entry: RankedEntry };

/** Um evento aceito de entrada que saiu da lista, com o título lido de movies/. */
export type RemovedEvent = { type: 'removed'; entryId: string; tmdbId: number; title: string };

/** Um evento aceito. */
export type ValidEvent = EntryEvent | RemovedEvent;

/**
 * Fica só com os eventos que o servidor confirma pelo banco. Para 'added', 'moved' e 'commented':
 * a entrada existe, foi gravada por quem pede (`addedBy` para 'added', `updatedBy` para os outros)
 * e `updatedAt` está nos últimos 30 minutos. Para 'removed': a entrada não existe mais e o filme
 * está em movies/ (o título vem de lá, nunca do pedido); quem apagou não fica registrado, então
 * vale a palavra de quem é integrante. Os outros são ignorados sem erro. Repetidos (mesmo tipo e
 * entrada) contam uma vez, na ordem do lote.
 *
 * @param requested - Eventos do pedido, na ordem em que aconteceram.
 * @param entries - Entradas da lista, lidas do banco.
 * @param removedTitles - Título de cada filme de 'removed' encontrado em movies/, por tmdbId.
 * @param uid - Quem pede.
 * @param now - Momento do pedido.
 * @returns Os eventos aceitos.
 */
function selectValidEvents(
  requested: readonly RequestedEvent[],
  entries: readonly RankedEntry[],
  removedTitles: ReadonlyMap<number, string>,
  uid: string,
  now: Date,
): ValidEvent[] {
  const byId = new Map(entries.map((entry) => [entry.entryId, entry]));
  const seen = new Set<string>();
  const valid: ValidEvent[] = [];

  for (const { type, entryId, tmdbId } of requested) {
    const key = `${type}:${entryId}`;
    if (seen.has(key)) continue;
    const entry = byId.get(entryId);

    if (type === 'removed') {
      const title = tmdbId ? removedTitles.get(tmdbId) : undefined;
      if (entry || !tmdbId || !title) continue;
      seen.add(key);
      valid.push({ type, entryId, tmdbId, title });
      continue;
    }

    if (!entry) continue;
    const author = type === 'added' ? entry.addedBy : entry.updatedBy;
    const age = now.getTime() - entry.updatedAt.getTime();
    if (author !== uid || age > EVENT_FRESHNESS_MS) continue;
    seen.add(key);
    valid.push({ type, entry });
  }
  return valid;
}

export { selectValidEvents };
