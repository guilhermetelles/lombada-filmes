import { writeFeedItem } from '../feed/write-feed-item.js';
import { requireMember } from '../lists/list-access.js';
import { listDocument } from '../lists/list-repository.js';
import { readMemberProfile } from '../lists/member-profiles.js';
import { findMovie } from '../movies/movie-repository.js';
import { pushActivity } from '../notify/push-activity.js';
import type { Dependencies } from '../types/dependencies.js';
import { queueDocument } from './queue-repository.js';

/** O que tirar: quem pede, de qual lista e qual filme. */
type QueueRemoval = { uid: string; listId: string; tmdbId: number };

/**
 * Tira um filme da fila "Quero ver" da lista. Quando o filme estava na fila, grava um item
 * `queue.removed` na Atividade e avisa os outros integrantes que aceitam avisos de atividade. Sem
 * erro e sem aviso se ele não estava na fila.
 *
 * @param dependencies - Banco, Auth, FCM e relógio.
 * @param removal - Quem pede, a lista e o filme.
 * @returns Se o filme estava na fila e saiu agora.
 * @throws {NotFoundError} Se a lista não existir.
 * @throws {ForbiddenError} Se a pessoa não for integrante.
 */
async function removeFromQueue(dependencies: Dependencies, { uid, listId, tmdbId }: QueueRemoval): Promise<boolean> {
  const { db, auth, now } = dependencies;
  const list = requireMember((await listDocument(db, listId).get()).data(), uid);
  const reference = queueDocument(db, listId, tmdbId);
  // Só quem apagou de fato avisa: dois pedidos seguidos não geram dois avisos.
  const removed = await db.runTransaction(async (transaction) => {
    if (!(await transaction.get(reference)).exists) return false;
    transaction.delete(reference);
    return true;
  });
  if (!removed) return false;

  const name = list.memberProfiles?.[uid]?.name || (await readMemberProfile(auth, uid)).name;
  const movieTitle = (await findMovie(db, tmdbId))?.title;
  const film = movieTitle ?? 'um filme';
  const title = name ? `${name} tirou ${film} do Quero ver` : `${movieTitle ?? 'Um filme'} saiu do Quero ver`;
  const route = { name: 'queue' } as const;
  const createdAt = now();
  const { feedId } = await writeFeedItem(db, listId, {
    type: 'queue.removed',
    kind: 'lista',
    createdAt,
    actorUid: uid,
    title,
    route,
  });

  const body = 'Saiu da fila Quero ver de vocês.';
  for (const recipient of list.memberUids.filter((member) => member !== uid)) {
    await pushActivity(dependencies, { recipient, listId, feedId, title, body, route, now: createdAt });
  }
  return true;
}

export { removeFromQueue };
