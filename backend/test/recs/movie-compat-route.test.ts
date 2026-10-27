import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { movieRoute } from '../../api/movies/[tmdbId].js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators, signUp } from '../support/emulators.js';
import { fakeSources } from '../support/fake-sources.js';
import { getRequest, readErrorCode, withBearer } from '../support/requests.js';
import { LIST_ID, seedList } from './seed-list.js';

/** Corpo da resposta, só com o que o teste confere. */
type MovieBody = { tmdbId: number; title: string; compat?: { score: number; reason: string } };

const clock = new Date('2026-10-18T12:00:00Z');

let dependencies: ReturnType<typeof createTestDependencies>;
let idToken: string;

beforeEach(async () => {
  await resetEmulators();
  dependencies = createTestDependencies(fakeSources().fetch, () => clock);
  const member = await signUp('membro@exemplo.com');
  idToken = member.idToken;
  await seedList(dependencies.db, member.uid, clock);
});

const getAbyss = (query: string, token = idToken) =>
  movieRoute(() => dependencies)(getRequest(`/api/movies/2756?tmdbId=2756${query}`, withBearer(token)));

/**
 * Grava um recs/current mínimo, com um modelo que gosta de Aventura (o gênero de The Abyss) e,
 * se pedido, The Abyss entre as sugestões.
 *
 * @param withAbyss - Se The Abyss entra nos itens.
 */
async function seedRecs(withAbyss: boolean): Promise<void> {
  await dependencies.db.doc(`lists/${LIST_ID}/recs/current`).set({
    computedAt: clock,
    modelVersion: 'pairwise-logit-v1',
    model: { bias: -1, weights: { 'genre:Aventura': 2.5, vote: 1 } },
    items: withAbyss
      ? [
          {
            tmdbId: 2756,
            title: 'O Segredo do Abismo',
            year: 1989,
            posterPath: null,
            runtime: 138,
            genres: ['Aventura'],
            providers: [],
            score: 81,
            reason: 'Motivo guardado de teste',
            reasonFrom: ['e101'],
            source: 'model',
            kind: 'tema',
          },
        ]
      : [],
    trending: [],
  });
}

describe('GET /api/movies/{tmdbId}?listId=', () => {
  test('sem listId: sem compat', async () => {
    await seedRecs(false);
    const body = (await (await getAbyss('')).json()) as MovieBody;
    assert.equal(body.tmdbId, 2756);
    assert.equal(body.compat, undefined);
  });

  test('lista sem modelo guardado: sem compat', async () => {
    const response = await getAbyss(`&listId=${LIST_ID}`);
    assert.equal(response.status, 200);
    assert.equal(((await response.json()) as MovieBody).compat, undefined);
  });

  test('com modelo: nota inteira de 0 a 100 pelo modelo, motivo pelas variáveis', async () => {
    await seedRecs(false);
    const body = (await (await getAbyss(`&listId=${LIST_ID}`)).json()) as MovieBody;
    assert.ok(body.compat);
    assert.ok(Number.isInteger(body.compat.score) && body.compat.score > 50 && body.compat.score <= 100);
    assert.equal(body.compat.reason, 'Pesa a favor no gosto de vocês: Aventura');
  });

  test('filme entre as sugestões: a nota e o motivo guardados', async () => {
    await seedRecs(true);
    const body = (await (await getAbyss(`&listId=${LIST_ID}`)).json()) as MovieBody;
    assert.deepEqual(body.compat, { score: 81, reason: 'Motivo guardado de teste' });
  });

  test('filme fora da vez na rotação: a nota e o motivo guardados em scores', async () => {
    await seedRecs(false);
    await dependencies.db
      .doc(`lists/${LIST_ID}/recs/current`)
      .update({ scores: { '2756': { score: 77, reason: 'Motivo fora da vez de teste' } } });
    const body = (await (await getAbyss(`&listId=${LIST_ID}`)).json()) as MovieBody;
    assert.deepEqual(body.compat, { score: 77, reason: 'Motivo fora da vez de teste' });
  });

  test('quem não é da lista: 403', async () => {
    await seedRecs(false);
    const outsider = await signUp('fora@exemplo.com');
    const response = await getAbyss(`&listId=${LIST_ID}`, outsider.idToken);
    assert.equal(response.status, 403);
    assert.equal(await readErrorCode(response), 'forbidden');
  });

  test('listId inválido: 400', async () => {
    const response = await getAbyss('&listId=a/b');
    assert.equal(response.status, 400);
  });
});
