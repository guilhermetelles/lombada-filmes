import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { discoverRouteWith } from '../../api/_discover.js';
import { createTmdbDiscoverClient } from '../../lib/discover/tmdb-discover-client.js';
import type { Dependencies } from '../../lib/types/dependencies.js';
import type { DiscoverPage } from '../../lib/types/discover.js';
import { usageDay } from '../../lib/usage/usage-day.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators, signUp } from '../support/emulators.js';
import { fakeSources } from '../support/fake-sources.js';
import { getRequest, readErrorCode, withBearer } from '../support/requests.js';
import { type DiscoverFetch, discoverFetch } from './discover-fixtures.js';

const LIST_ID = 'lista-de-teste';
const NOW = new Date('2026-10-18T15:00:00Z');

let tmdb: DiscoverFetch;
let dependencies: Dependencies;
let uid: string;
let idToken: string;

beforeEach(async () => {
  await resetEmulators();
  tmdb = discoverFetch();
  dependencies = createTestDependencies(fakeSources().fetch, () => NOW);
  ({ uid, idToken } = await signUp('pessoa@exemplo.com'));
});

/**
 * Chama GET /api/discover com o TMDb gravado.
 *
 * @param query - Query, sem o "?".
 * @param init - Cabeçalhos (o token da pessoa, por padrão).
 * @returns A resposta.
 */
function discover(query: string, init: RequestInit = withBearer(idToken)): Promise<Response> {
  const route = discoverRouteWith(() => createTmdbDiscoverClient({ token: 't', fetch: tmdb.fetch }));
  return route(() => dependencies)(getRequest(`/api/discover?${query}`, init));
}

/**
 * Grava uma lista com a pessoa como membro.
 *
 * @param memberUids - Membros.
 */
async function createList(memberUids: string[] = [uid]): Promise<void> {
  await dependencies.db.doc(`lists/${LIST_ID}`).set({
    name: 'Lista de teste',
    description: '',
    ownerUid: memberUids[0] ?? uid,
    memberUids,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

/**
 * Grava filmes na lista, na ordem do ranking, com o documento de cada filme (só os campos que a
 * validação de movies/{tmdbId} exige).
 *
 * @param movies - Id do TMDb e gêneros de cada filme, do primeiro ao último.
 */
async function addEntries(movies: { tmdbId: number; genres: string[] }[]): Promise<void> {
  for (const [index, { tmdbId, genres }] of movies.entries()) {
    await dependencies.db.doc(`movies/${tmdbId}`).set({
      title: `Filme ${tmdbId}`,
      year: 2000,
      directors: [],
      cast: [],
      runtime: null,
      genres,
      synopsis: { pt: null, en: null },
      posterPath: null,
      ids: { imdb: null, letterboxd: null },
      ratings: {},
      tmdbFetchedAt: NOW,
    });
    await dependencies.db.doc(`lists/${LIST_ID}/entries/entrada-${tmdbId}`).set({
      tmdbId,
      rankKey: `a${index}`,
      watchedOn: null,
      comment: '',
      addedBy: uid,
      updatedBy: uid,
      createdAt: NOW,
      updatedAt: NOW,
      movie: { title: `Filme ${tmdbId}`, year: 2000, posterPath: null, imdb: null, letterboxd: null, directors: [] },
    });
  }
}

describe('GET /api/discover', () => {
  test('sem lista: página pontuada pela nota do TMDb, e o consumo do TMDb contado', async () => {
    const response = await discover('genre=Comédia&theme=lgbt');
    const page = (await response.json()) as DiscoverPage;

    assert.equal(response.status, 200);
    assert.equal(page.results.length, 20);
    assert.equal(page.results[0]?.reason, 'Nota do TMDb');
    const usage = await dependencies.db.doc(`usage/${usageDay(NOW)}`).get();
    assert.deepEqual(usage.get('tmdb'), { calls: 12 });
  });

  test('com lista sem modelo: gêneros dos 20 primeiros e o filme da lista marcado', async () => {
    await createList();
    // 3 filmes de Comédia no topo, 1 de Drama; Green Book (490132) já está na lista.
    await addEntries([
      { tmdbId: 9472, genres: ['Comédia'] },
      { tmdbId: 1022690, genres: ['Comédia'] },
      { tmdbId: 490132, genres: ['Drama', 'Comédia', 'História'] },
      { tmdbId: 11, genres: ['Aventura'] },
    ]);

    const response = await discover(`listId=${LIST_ID}&genre=Comédia&theme=lgbt`);
    const page = (await response.json()) as DiscoverPage;

    assert.equal(response.status, 200);
    const greenBook = page.results.find((item) => item.tmdbId === 490132);
    assert.equal(greenBook?.inListEntryId, 'entrada-490132');
    // Comédia 3/4, Drama 1/4, História 1/4: 1 − 0,25 × 0,75 × 0,75
    assert.equal(greenBook?.score, Math.round(100 * (1 - 0.25 * 0.75 * 0.75)));
    assert.equal(greenBook?.reason, 'Comédia e Drama: gêneros que vocês põem no topo');
    assert.equal(page.results.filter((item) => item.inListEntryId !== null).length, 3); // Green Book, 9472 e 1022690
  });

  test('com modelo em recs/current: os pesos pontuam e o motivo cita o que pesou', async () => {
    await createList();
    await dependencies.db.doc(`lists/${LIST_ID}/recs/current`).set({
      computedAt: NOW,
      modelVersion: 'teste',
      model: { bias: -2, weights: { 'genre:Terror': 4, 'genre:Drama': -1 } },
      items: [],
      trending: [],
    });

    const page = (await (await discover(`listId=${LIST_ID}`)).json()) as DiscoverPage;
    // Acampamento Miasma (1240889) é o único de Terror na página gravada.
    assert.equal(page.results[0]?.tmdbId, 1240889);
    assert.equal(page.results[0]?.score, Math.round(100 / (1 + Math.exp(-2))));
    assert.equal(page.results[0]?.reason, 'Pesa a favor no gosto de vocês: Terror');
  });

  test('fit=true com lista: só o que passa de 60', async () => {
    await createList();
    await addEntries([{ tmdbId: 9472, genres: ['Comédia'] }]);
    const page = (await (await discover(`listId=${LIST_ID}&fit=true`)).json()) as DiscoverPage;
    assert.ok(page.results.length > 0);
    assert.ok(page.results.every((item) => item.score >= 60));
  });

  test('lista de outra pessoa: 403; lista que não existe: 404; sem pedir ao TMDb', async () => {
    const other = await signUp('outra@exemplo.com');
    await createList([other.uid]);
    const forbidden = await discover(`listId=${LIST_ID}`);
    assert.equal(forbidden.status, 403);
    assert.equal(await readErrorCode(forbidden), 'forbidden');
    assert.equal((await discover('listId=nao-existe')).status, 404);
    assert.equal(tmdb.urls.length, 0);
  });

  test('filtro inválido: 400; sem token: 401', async () => {
    const invalid = await discover('mood=alegre');
    assert.equal(invalid.status, 400);
    assert.equal(await readErrorCode(invalid), 'invalid_input');
    assert.equal((await discover('', {})).status, 401);
    assert.equal(tmdb.urls.length, 0);
  });

  test('TMDb fora do ar no /discover: 502', async () => {
    tmdb.failing.add('discover');
    const response = await discover('');
    assert.equal(response.status, 502);
    assert.equal(await readErrorCode(response), 'source_unavailable');
  });
});
