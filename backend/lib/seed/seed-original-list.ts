import type { Firestore } from 'firebase-admin/firestore';
import { generateNKeysBetween } from 'fractional-indexing';
import { createInvite } from '../lists/create-invite.js';
import { listDocument } from '../lists/list-repository.js';
import { getFreshMovie } from '../movies/get-fresh-movie.js';
import { toMovieSnapshot } from '../movies/movie-snapshot.js';
import { InviteSchema } from '../schemas/list.js';
import type { Dependencies } from '../types/dependencies.js';
import type { Entry } from '../types/entry.js';
import type { CreatedInvite } from '../types/list.js';
import type { OriginalEntry, OriginalListInfo, SeedSummary } from '../types/seed.js';
import type { UsageRecorder } from '../types/usage.js';

/** Id fixo da lista original, para a carga poder rodar de novo sem duplicar. */
export const ORIGINAL_LIST_ID = 'competicao-de-filmes-terriveis';

/** A lista no Letterboxd de onde veio o export. */
export const ORIGINAL_LETTERBOXD_URL = 'https://boxd.it/Gsf3k';

type SeedInput = {
  dependencies: Dependencies;
  usage: UsageRecorder;
  ownerUid: string;
  listInfo: OriginalListInfo;
  entries: OriginalEntry[];
  onProgress?: (message: string) => void;
};

/**
 * Carrega a lista original no banco: a lista com a dona como única integrante, as entradas na
 * ordem do mock (rankKey em sequência), o documento de cada filme e um código de convite válido.
 * Pode rodar de novo: usa ids fixos e não regrava entradas que já existem, para não perder
 * comentários editados depois pelo app.
 *
 * @param input - Dependências, medidor de consumo, dona, dados da lista e filmes na ordem.
 * @returns O que foi criado e o código de convite para a outra pessoa entrar.
 * @throws {NotFoundError} Se o TMDb não tiver algum dos filmes.
 * @throws {SourceUnavailableError} Se o TMDb falhar na primeira busca de algum filme.
 */
export async function seedOriginalList({
  dependencies,
  usage,
  ownerUid,
  listInfo,
  entries,
  onProgress = () => {},
}: SeedInput): Promise<SeedSummary> {
  const { db, now } = dependencies;
  const startedAt = now();
  const listCreated = await createListIfMissing(db, ownerUid, listInfo, startedAt);
  const rankKeys = generateNKeysBetween(null, null, entries.length);

  let entriesCreated = 0;
  for (const [index, original] of entries.entries()) {
    const movie = await getFreshMovie(original.tmdbId, dependencies, usage);
    const created = await createEntryIfMissing(
      db,
      ownerUid,
      original,
      rankKeys[index] ?? '',
      toMovieSnapshot(movie),
      now(),
    );
    if (created) entriesCreated++;
    onProgress(`${original.position}/${entries.length} ${movie.title}${created ? '' : ' (já existia)'}`);
  }

  const invite =
    (await findValidInvite(db, startedAt)) ?? (await createInvite(db, ownerUid, ORIGINAL_LIST_ID, startedAt));
  return {
    listId: ORIGINAL_LIST_ID,
    listCreated,
    entriesCreated,
    entriesKept: entries.length - entriesCreated,
    inviteCode: invite.inviteCode,
    inviteExpiresAt: invite.expiresAt,
  };
}

/**
 * Cria a lista original se ela ainda não existir.
 *
 * @param db - Firestore.
 * @param ownerUid - Dona e única integrante.
 * @param listInfo - Nome e descrição do mock.
 * @param now - Momento da carga.
 * @returns true se a lista foi criada agora.
 */
async function createListIfMissing(
  db: Firestore,
  ownerUid: string,
  { name, description }: OriginalListInfo,
  now: Date,
): Promise<boolean> {
  const list = listDocument(db, ORIGINAL_LIST_ID);
  if ((await list.get()).exists) return false;
  await list.create({
    name,
    description,
    ownerUid,
    memberUids: [ownerUid],
    source: { letterboxdUrl: ORIGINAL_LETTERBOXD_URL, importedAt: now },
    createdAt: now,
    updatedAt: now,
  });
  return true;
}

/**
 * Cria a entrada de um filme se ela ainda não existir. O id é fixo (tmdb-{id}).
 *
 * @param db - Firestore.
 * @param ownerUid - Quem adiciona (a dona).
 * @param original - Filme, data e comentário do mock.
 * @param rankKey - Chave de ordem da posição dele.
 * @param movie - Cópia resumida do filme.
 * @param now - Momento da gravação.
 * @returns true se a entrada foi criada agora.
 */
async function createEntryIfMissing(
  db: Firestore,
  ownerUid: string,
  original: OriginalEntry,
  rankKey: string,
  movie: Entry['movie'],
  now: Date,
): Promise<boolean> {
  const entry = db.doc(`lists/${ORIGINAL_LIST_ID}/entries/tmdb-${original.tmdbId}`);
  if ((await entry.get()).exists) return false;
  const data: Entry = {
    tmdbId: original.tmdbId,
    rankKey,
    watchedOn: original.watchedOn,
    comment: original.comment,
    addedBy: ownerUid,
    updatedBy: ownerUid,
    createdAt: now,
    updatedAt: now,
    movie,
  };
  await entry.create(data);
  return true;
}

/**
 * Procura um código de convite da lista original que ainda não venceu.
 *
 * @param db - Firestore.
 * @param now - Momento de referência.
 * @returns O código mais longe de vencer, ou undefined se não houver.
 */
async function findValidInvite(db: Firestore, now: Date): Promise<CreatedInvite | undefined> {
  const invites = await db.collection('invites').where('listId', '==', ORIGINAL_LIST_ID).get();
  return invites.docs
    .map((doc) => ({ inviteCode: doc.id, expiresAt: InviteSchema.parse(doc.data()).expiresAt }))
    .filter((invite) => invite.expiresAt.getTime() > now.getTime())
    .sort((a, b) => b.expiresAt.getTime() - a.expiresAt.getTime())[0];
}
