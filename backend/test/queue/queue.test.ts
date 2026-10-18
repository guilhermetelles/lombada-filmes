import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { addToQueueRoute } from '../../api/lists/[listId]/queue/_add.js';
import { removeFromQueueRoute } from '../../api/lists/[listId]/queue/_remove.js';
import { createListRoute } from '../../api/lists/index.js';
import { joinListRoute } from '../../api/lists/join.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators, signUp } from '../support/emulators.js';
import { type FakeSources, fakeSources } from '../support/fake-sources.js';
import { jsonRequest, readErrorCode } from '../support/requests.js';

type Person = { uid: string; idToken: string };
type CreatedList = { listId: string; inviteCode: string };

/** The Abyss: o filme das gravações de test/fixtures. */
const ABYSS = 2756;

let sources: FakeSources;
let clock: Date;
let dependencies: ReturnType<typeof createTestDependencies>;
let ana: Person;
let bia: Person;
let outsider: Person;
let listId: string;

beforeEach(async () => {
  await resetEmulators();
  sources = fakeSources();
  clock = new Date('2026-10-16T15:00:00Z');
  dependencies = createTestDependencies(sources.fetch, () => clock);
  [ana, bia, outsider] = await Promise.all([
    signUp('ana@exemplo.com'),
    signUp('bia@exemplo.com'),
    signUp('de-fora@exemplo.com'),
  ]);
  await dependencies.auth.updateUser(ana.uid, { displayName: 'Ana' });
  await dependencies.auth.updateUser(bia.uid, { displayName: 'Bia' });

  const created = await createListRoute(withDependencies)(jsonRequest('/api/lists', { name: 'Maratona' }, ana.idToken));
  const list = (await created.json()) as CreatedList;
  listId = list.listId;
  await joinListRoute(withDependencies)(jsonRequest('/api/lists/join', { code: list.inviteCode }, bia.idToken));
});

const withDependencies = () => dependencies;
const add = (person: Person, body: unknown, id = listId) =>
  addToQueueRoute(withDependencies)(jsonRequest(`/api/lists/${id}/queue?listId=${id}`, body, person.idToken));
const remove = (person: Person, tmdbId: string | number, id = listId) =>
  removeFromQueueRoute(withDependencies)(
    new Request(`http://localhost/api/lists/${id}/queue/${tmdbId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${person.idToken}` },
    }),
  );
const queueItem = async (tmdbId: number) => (await dependencies.db.doc(`lists/${listId}/queue/${tmdbId}`).get()).data();
const feedItems = async () =>
  (await dependencies.db.collection(`lists/${listId}/feed`).get()).docs.map((doc) => doc.data());

describe('POST /api/lists/{listId}/queue', () => {
  test('põe o filme na fila, guarda o filme completo e grava queue.added na Atividade', async () => {
    const response = await add(bia, { tmdbId: ABYSS });

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { tmdbId: ABYSS });

    const item = await queueItem(ABYSS);
    assert.deepEqual([item?.tmdbId, item?.addedBy, item?.createdAt.toMillis()], [ABYSS, bia.uid, clock.getTime()]);

    const movie = (await dependencies.db.doc(`movies/${ABYSS}`).get()).data();
    assert.equal(movie?.title, 'The Abyss');
    assert.ok(movie?.ratings.imdb, 'o filme fica com dados completos para a página');

    const feed = await feedItems();
    assert.equal(feed.length, 1);
    assert.deepEqual(
      {
        type: feed[0]?.type,
        kind: feed[0]?.kind,
        actorUid: feed[0]?.actorUid,
        title: feed[0]?.title,
        route: feed[0]?.route,
      },
      {
        type: 'queue.added',
        kind: 'lista',
        actorUid: bia.uid,
        title: 'Bia quer ver The Abyss',
        route: { name: 'movie', args: { tmdbId: ABYSS } },
      },
    );
  });

  test('o mesmo filme de novo: 201, sem regravar a fila nem duplicar a Atividade', async () => {
    await add(bia, { tmdbId: ABYSS });
    clock = new Date(clock.getTime() + 60_000);

    const again = await add(ana, { tmdbId: ABYSS });

    assert.equal(again.status, 201);
    assert.equal((await queueItem(ABYSS))?.addedBy, bia.uid);
    assert.equal((await feedItems()).length, 1);
  });

  test('pessoa sem nome no Google: o título fala só do filme', async () => {
    await dependencies.auth.updateUser(bia.uid, { displayName: null });
    await add(bia, { tmdbId: ABYSS });
    assert.equal((await feedItems())[0]?.title, 'The Abyss entrou na fila');
  });

  test('filme que já está nas entradas da lista: 409 conflict, sem buscar fontes nem gravar', async () => {
    await dependencies.db.doc(`lists/${listId}/entries/entrada-1`).set({ tmdbId: ABYSS });

    const response = await add(ana, { tmdbId: ABYSS });

    assert.equal(response.status, 409);
    assert.equal(await readErrorCode(response), 'conflict');
    assert.equal(sources.calls.tmdb, 0);
    assert.equal(await queueItem(ABYSS), undefined);
    assert.equal((await feedItems()).length, 0);
  });

  test('quem não é integrante: 403; lista que não existe: 404', async () => {
    const forbidden = await add(outsider, { tmdbId: ABYSS });
    assert.equal(forbidden.status, 403);
    assert.equal(await queueItem(ABYSS), undefined);

    const missing = await add(ana, { tmdbId: ABYSS }, 'nao-existe');
    assert.equal(missing.status, 404);
  });

  test('filme que o TMDb não tem: 404 e nada na fila', async () => {
    const response = await add(ana, { tmdbId: 99999999 });
    assert.equal(response.status, 404);
    assert.equal(await queueItem(99999999), undefined);
    assert.equal((await feedItems()).length, 0);
  });

  test('tmdbId inválido: 400', async () => {
    for (const body of [{}, { tmdbId: '2756' }, { tmdbId: -1 }, { tmdbId: 1.5 }]) {
      const response = await add(ana, body);
      assert.equal(response.status, 400, JSON.stringify(body));
    }
  });
});

describe('DELETE /api/lists/{listId}/queue/{tmdbId}', () => {
  test('tira o filme da fila', async () => {
    await add(ana, { tmdbId: ABYSS });

    const response = await remove(bia, ABYSS);

    assert.equal(response.status, 204);
    assert.equal(await queueItem(ABYSS), undefined);
  });

  test('filme que não estava na fila: 204', async () => {
    assert.equal((await remove(ana, 603)).status, 204);
  });

  test('quem não é integrante: 403 e o filme fica', async () => {
    await add(ana, { tmdbId: ABYSS });
    assert.equal((await remove(outsider, ABYSS)).status, 403);
    assert.ok(await queueItem(ABYSS));
  });

  test('tmdbId inválido: 400', async () => {
    assert.equal((await remove(ana, 'abc')).status, 400);
  });
});
