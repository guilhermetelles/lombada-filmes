import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { writeFeedItem } from '../feed/write-feed-item.js';
import { writeInBatches } from '../firestore/write-in-batches.js';
import { requireMember } from '../lists/list-access.js';
import { listDocument } from '../lists/list-repository.js';
import { readMemberProfile } from '../lists/member-profiles.js';
import { logger } from '../logging/logger.js';
import { pushActivity } from '../notify/push-activity.js';
import { queueDocument } from '../queue/queue-repository.js';
import { onListChanged } from '../recs/on-list-changed.js';
import type { Dependencies } from '../types/dependencies.js';
import type { List } from '../types/list.js';
import { consumeEventsQuota } from './events-rate-limit.js';
import { readRankedEntries } from './list-entries.js';
import { type RequestedEvent, selectValidEvents, type ValidEvent } from './select-valid-events.js';
import { summarizeEvents } from './summarize-events.js';

/** Um lote vindo do app: quem manda, a lista e os eventos. */
type EventsRequest = { uid: string; listId: string; items: readonly RequestedEvent[] };

/** Corpo do aviso quando o lote não tem comentário nem posições a mostrar. */
const FALLBACK_PUSH_BODY = 'Veja na Atividade da lista.';

/**
 * Trata um lote de eventos do app. Confere que a pessoa é integrante e aceita só os eventos que o
 * banco confirma (selectValidEvents); tira da fila "Quero ver" os filmes que viraram entrada; avisa
 * o motor de sugestões; e, dentro do limite diário de lotes, grava um item `member.activity` com o
 * resumo do lote e manda um aviso a cada outro integrante que aceita avisos de atividade,
 * respeitando o intervalo de 15 minutos e o máximo de 6 por dia.
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

  const entries = await readRankedEntries(db, listId);
  const events = selectValidEvents(items, entries, uid, now);
  if (events.length === 0) return false;

  await removeAddedFromQueue(db, listId, events);
  if (events.some((event) => event.type !== 'commented')) await notifyRecs(db, listId);

  if (!(await consumeEventsQuota(db, uid, now))) {
    logger.warn('limite diário de lotes de eventos atingido', { uid, listId });
    return false;
  }

  const summary = summarizeEvents(await actorName(list, auth, uid), events, entries.length);
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
 * Tira da fila "Quero ver" os filmes que entraram na lista neste lote.
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @param events - Eventos aceitos.
 */
async function removeAddedFromQueue(db: Firestore, listId: string, events: readonly ValidEvent[]): Promise<void> {
  const added = [...new Set(events.filter((event) => event.type === 'added').map((event) => event.entry.tmdbId))];
  await writeInBatches(db, added, (batch, tmdbId) => batch.delete(queueDocument(db, listId, tmdbId)));
}

/**
 * Chama o gancho das sugestões. Uma falha ali só vai para o log: não derruba o lote.
 *
 * @param db - Firestore.
 * @param listId - Lista que mudou.
 */
async function notifyRecs(db: Firestore, listId: string): Promise<void> {
  try {
    await onListChanged(db, listId);
  } catch (error) {
    logger.warn('falha ao reajustar as sugestões depois dos eventos', { listId, error });
  }
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
