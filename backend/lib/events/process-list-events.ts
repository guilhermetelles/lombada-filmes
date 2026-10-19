import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { writeFeedItem } from '../feed/write-feed-item.js';
import { writeInBatches } from '../firestore/write-in-batches.js';
import { requireMember } from '../lists/list-access.js';
import { listDocument } from '../lists/list-repository.js';
import { readMemberProfile } from '../lists/member-profiles.js';
import { logger } from '../logging/logger.js';
import { findMovies } from '../movies/movie-repository.js';
import { pushActivity } from '../notify/push-activity.js';
import { queueDocument } from '../queue/queue-repository.js';
import { onListChanged } from '../recs/on-list-changed.js';
import type { Dependencies } from '../types/dependencies.js';
import type { List } from '../types/list.js';
import { consumeEventsQuota } from './events-rate-limit.js';
import { readEntriesWithPositions } from './list-entries.js';
import { type RequestedEvent, selectValidEvents, type ValidEvent } from './select-valid-events.js';
import { summarizeEvents } from './summarize-events.js';

/** Um lote vindo do app: quem manda, a lista e os eventos. */
type EventsRequest = { uid: string; listId: string; items: readonly RequestedEvent[] };

/** Corpo do aviso quando o lote não tem comentário nem posições a mostrar. */
const FALLBACK_PUSH_BODY = 'Veja na Atividade da lista.';

/**
 * Trata um lote de eventos do app. Confere que a pessoa é integrante e aceita só os eventos que o
 * banco confirma (selectValidEvents), inclusive filmes retirados da lista; tira da fila "Quero ver"
 * os filmes que viraram entrada; tira das sugestões os filmes que entraram; e, dentro do limite
 * diário de lotes, grava um item `member.activity` com o resumo do lote e manda um aviso a cada
 * outro integrante que aceita avisos de atividade.
 *
 * Lê só o que o lote cita: as entradas pedidas (getAll), a posição de cada uma por count() e o
 * tamanho da lista também por count(), em vez da lista inteira. Um lote típico (um ou dois filmes,
 * duas pessoas) fica em torno de 10 leituras; o pior caso (50 entradas) passa pouco de 100.
 *
 * @param dependencies - Banco, Auth, FCM e relógio.
 * @param request - Quem manda, a lista e os eventos.
 * @returns Se algum aviso saiu para algum aparelho.
 * @throws {NotFoundError} Se a lista não existir.
 * @throws {ForbiddenError} Se a pessoa não for integrante.
 */
async function processListEvents(dependencies: Dependencies, { uid, listId, items }: EventsRequest): Promise<boolean> {
  const { db, auth } = dependencies;
  const now = dependencies.now();
  const list = requireMember((await listDocument(db, listId).get()).data(), uid);

  const { entries, total } = await readEntriesWithPositions(
    db,
    listId,
    items.map((item) => item.entryId),
  );
  const removedIds = [
    ...new Set(items.flatMap((item) => (item.type === 'removed' && item.tmdbId ? [item.tmdbId] : []))),
  ];
  const removedTitles = new Map(
    [...(await findMovies(db, removedIds))].map(([tmdbId, movie]) => [tmdbId, movie.title]),
  );
  const events = selectValidEvents(items, entries, removedTitles, uid, now);
  if (events.length === 0) return false;

  const entered = addedMovieIds(events);
  await removeAddedFromQueue(db, listId, entered);
  await onListChanged(db, listId, entered);

  if (!(await consumeEventsQuota(db, uid, now))) {
    logger.warn('limite diário de lotes de eventos atingido', { uid, listId });
    return false;
  }

  const summary = summarizeEvents(await actorName(list, auth, uid), events, total);
  const { feedId } = await writeFeedItem(db, listId, {
    type: 'member.activity',
    kind: 'lista',
    createdAt: now,
    actorUid: uid,
    ...summary,
  });

  let pushed = false;
  for (const recipient of list.memberUids.filter((member) => member !== uid)) {
    const body = summary.quote ? `“${summary.quote}”` : (summary.body ?? FALLBACK_PUSH_BODY);
    const push = { recipient, listId, feedId, title: summary.title, body, route: summary.route, now };
    if (await pushActivity(dependencies, push)) pushed = true;
  }
  return pushed;
}

/**
 * Filmes que entraram na lista neste lote, sem repetição.
 *
 * @param events - Eventos aceitos.
 * @returns Os ids do TMDb.
 */
function addedMovieIds(events: readonly ValidEvent[]): number[] {
  return [...new Set(events.flatMap((event) => (event.type === 'added' ? [event.entry.tmdbId] : [])))];
}

/**
 * Tira da fila "Quero ver" os filmes que entraram na lista neste lote.
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @param added - Filmes que entraram.
 */
async function removeAddedFromQueue(db: Firestore, listId: string, added: readonly number[]): Promise<void> {
  await writeInBatches(db, [...added], (batch, tmdbId) => batch.delete(queueDocument(db, listId, tmdbId)));
}

/**
 * Nome de quem mexeu: o guardado em memberProfiles da lista; sem ele, o do Firebase Auth.
 *
 * @param list - Lista.
 * @param auth - Auth do Admin SDK.
 * @param uid - Quem mexeu.
 * @returns O nome, ou vazio se a conta não tiver nome.
 */
async function actorName(list: List, auth: Pick<Auth, 'getUser'>, uid: string): Promise<string> {
  const stored = list.memberProfiles?.[uid]?.name;
  if (stored) return stored;
  try {
    return (await readMemberProfile(auth, uid)).name;
  } catch (error) {
    logger.warn('nome do integrante não lido', { uid, error });
    return '';
  }
}

export { processListEvents };
