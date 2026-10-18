import { joinPt, plural } from '../notify/portuguese-text.js';
import type { RouteRef } from '../types/feed.js';
import type { RankedEntry } from './list-entries.js';
import type { ValidEvent } from './select-valid-events.js';

/** Quantos filmes aparecem pelo nome no texto antes de virar "e mais N". */
const NAMED_LIMIT = 3;

/** Resumo de um lote, pronto para o item `member.activity` da Atividade. */
export type EventsSummary = {
  title: string;
  body?: string | undefined;
  quote?: string | undefined; // comentário verbatim da entrada, lido do banco
  route: RouteRef;
};

/**
 * Resume um lote de eventos aceitos numa frase só: "Ana adicionou Speed e reordenou 3 filmes".
 * Entradas novas não contam de novo como reordenadas ou comentadas. O corpo diz as posições
 * calculadas no servidor; a citação é o comentário guardado da última entrada comentada (ou, sem
 * comentário novo, da última adicionada com comentário). Um filme só abre o filme; mais de um, a
 * Atividade.
 *
 * @param actorName - Nome de quem mexeu na lista; vazio quando a conta não tem nome.
 * @param events - Eventos aceitos, na ordem do lote (pelo menos um).
 * @param totalEntries - Quantas entradas a lista tem agora.
 * @returns Título, corpo, citação e rota do item.
 */
function summarizeEvents(actorName: string, events: readonly ValidEvent[], totalEntries: number): EventsSummary {
  const added = uniqueEntries(events, 'added');
  const addedIds = new Set(added.map((entry) => entry.entryId));
  const moved = uniqueEntries(events, 'moved').filter((entry) => !addedIds.has(entry.entryId));
  const commented = uniqueEntries(events, 'commented').filter((entry) => !addedIds.has(entry.entryId));

  const phrases: string[] = [];
  if (added.length > 0) phrases.push(`adicionou ${namedOrCount(added)}`);
  const [onlyMoved] = moved;
  if (moved.length === 1 && onlyMoved) phrases.push(`moveu ${onlyMoved.movie.title} para #${onlyMoved.position}`);
  if (moved.length > 1) phrases.push(`reordenou ${plural(moved.length, 'filme', 'filmes')}`);
  if (commented.length > 0) phrases.push(`comentou ${namedOrCount(commented)}`);

  const actor = actorName || 'Alguém da lista';
  const distinct = new Map(events.map(({ entry }) => [entry.entryId, entry]));
  const [single] = distinct.values();
  const route: RouteRef =
    distinct.size === 1 && single ? { name: 'movie', args: { tmdbId: single.tmdbId } } : { name: 'feed' };

  return {
    title: `${actor} ${joinPt(phrases)}`,
    body: positionsText(added, moved, totalEntries),
    quote: quoteOf(events),
    route,
  };
}

/**
 * Entradas de um tipo de evento, sem repetição, na ordem do lote.
 *
 * @param events - Eventos aceitos.
 * @param type - Tipo procurado.
 * @returns As entradas.
 */
function uniqueEntries(events: readonly ValidEvent[], type: ValidEvent['type']): RankedEntry[] {
  const entries = new Map<string, RankedEntry>();
  for (const event of events) if (event.type === type) entries.set(event.entry.entryId, event.entry);
  return [...entries.values()];
}

/**
 * Até dois filmes pelo nome ("Speed e Twister"); mais que isso, a contagem ("4 filmes").
 *
 * @param entries - Entradas.
 * @returns O pedaço da frase.
 */
function namedOrCount(entries: readonly RankedEntry[]): string {
  if (entries.length <= 2) return joinPt(entries.map((entry) => entry.movie.title));
  return plural(entries.length, 'filme', 'filmes');
}

/**
 * Diz onde ficaram os filmes novos e, quando a frase não disse, os reordenados.
 *
 * @param added - Entradas novas.
 * @param moved - Entradas reordenadas (sem as novas).
 * @param totalEntries - Tamanho da lista.
 * @returns O corpo do item, ou undefined se a frase já disse tudo.
 */
function positionsText(added: RankedEntry[], moved: RankedEntry[], totalEntries: number): string | undefined {
  const sentences: string[] = [];
  const [onlyAdded] = added;
  if (added.length === 1 && onlyAdded) sentences.push(`Entrou em #${onlyAdded.position} de ${totalEntries}.`);
  if (added.length > 1) sentences.push(`Entraram: ${withPositions(added)}.`);
  if (moved.length > 1) sentences.push(`Novas posições: ${withPositions(moved)}.`);
  return sentences.length > 0 ? sentences.join(' ') : undefined;
}

/**
 * Lista filmes com a posição, na ordem do ranking: "Speed (#3), Twister (#8) e mais 2".
 *
 * @param entries - Entradas.
 * @returns O texto.
 */
function withPositions(entries: readonly RankedEntry[]): string {
  const ranked = [...entries].sort((a, b) => a.position - b.position);
  const named = ranked.slice(0, NAMED_LIMIT).map((entry) => `${entry.movie.title} (#${entry.position})`);
  const rest = ranked.length - named.length;
  return rest > 0 ? `${named.join(', ')} e mais ${rest}` : joinPt(named);
}

/**
 * Comentário a citar: o da última entrada comentada no lote; sem comentário novo, o da última
 * entrada adicionada que tem comentário.
 *
 * @param events - Eventos aceitos, na ordem do lote.
 * @returns O comentário guardado, verbatim, ou undefined.
 */
function quoteOf(events: readonly ValidEvent[]): string | undefined {
  const lastWithComment = (type: ValidEvent['type']) =>
    events.findLast((event) => event.type === type && event.entry.comment.trim() !== '')?.entry.comment;
  return lastWithComment('commented') ?? lastWithComment('added');
}

export { summarizeEvents };
