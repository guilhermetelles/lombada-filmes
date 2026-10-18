import { ConflictError } from '../errors/app-errors.js';
import { writeFeedItem } from '../feed/write-feed-item.js';
import { createIfAbsent } from '../firestore/idempotent.js';
import { requireMember } from '../lists/list-access.js';
import { entriesOfMovie, listDocument } from '../lists/list-repository.js';
import { readMemberProfile } from '../lists/member-profiles.js';
import { getFreshMovie } from '../movies/get-fresh-movie.js';
import type { Dependencies } from '../types/dependencies.js';
import type { UsageRecorder } from '../types/usage.js';
import { queueDocument } from './queue-repository.js';

/** O que adicionar: quem pede, em qual lista e qual filme. */
type QueueRequest = { uid: string; listId: string; tmdbId: number };

/**
 * Põe um filme na fila "Quero ver" da lista. Garante o filme completo em movies/{tmdbId} (a página
 * do filme lê de lá), cria lists/{listId}/queue/{tmdbId} e, só quando o filme entra agora, grava um
 * item `queue.added` na Atividade com o nome de quem pediu e o título do filme. Pedir de novo um
 * filme que já está na fila não muda nada.
 *
 * @param dependencies - Banco, Auth, clientes das fontes e relógio.
 * @param usage - Medidor de consumo do pedido.
 * @param request - Quem pede, a lista e o filme.
 * @returns Se o filme entrou na fila agora (false se já estava).
 * @throws {NotFoundError} Se a lista não existir, ou se o filme não estiver guardado e o TMDb não o tiver.
 * @throws {ForbiddenError} Se a pessoa não for integrante.
 * @throws {ConflictError} Se o filme já estiver nas entradas da lista.
 * @throws {SourceUnavailableError} Se o filme não estiver guardado e o TMDb falhar.
 */
async function addToQueue(
  dependencies: Dependencies,
  usage: UsageRecorder,
  { uid, listId, tmdbId }: QueueRequest,
): Promise<boolean> {
  const { db, auth, now } = dependencies;
  requireMember((await listDocument(db, listId).get()).data(), uid);

  const inList = await entriesOfMovie(db, listId, tmdbId).limit(1).get();
  if (!inList.empty) throw new ConflictError('o filme já está na lista');

  const movie = await getFreshMovie(tmdbId, dependencies, usage);
  const createdAt = now();
  const added = await createIfAbsent(queueDocument(db, listId, tmdbId), { tmdbId, addedBy: uid, createdAt });
  if (!added) return false;

  const { name } = await readMemberProfile(auth, uid);
  await writeFeedItem(db, listId, {
    type: 'queue.added',
    kind: 'lista',
    createdAt,
    actorUid: uid,
    title: name ? `${name} quer ver ${movie.title}` : `${movie.title} entrou na fila`,
    route: { name: 'movie', args: { tmdbId } },
  });
  return true;
}

export { addToQueue };
