import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { recsCronRoute } from '../../api/cron/_recs.js';
import { onListChanged } from '../../lib/recs/on-list-changed.js';
import { DEFAULT_RECS_LIMITS } from '../../lib/recs/recs-run.js';
import { runRecs } from '../../lib/recs/run-recs.js';
import { RecsDocSchema } from '../../lib/schemas/recs.js';
import type { RecsDoc } from '../../lib/types/recs.js';
import { UsageMeter } from '../../lib/usage/usage-meter.js';
import { createTestDependencies, TEST_CRON_SECRET } from '../support/dependencies.js';
import { resetEmulators } from '../support/emulators.js';
import { createFakeGemini, type FakeGemini } from '../support/fake-gemini.js';
import { getRequest } from '../support/requests.js';
import { type FakeTmdb, fakeTmdb } from './fake-tmdb.js';
import { LIST_ID, seedList } from './seed-list.js';

const UID = 'membro-de-teste';
const clock = new Date('2026-10-18T08:00:00Z');

let tmdb: FakeTmdb;
let gemini: FakeGemini;
let dependencies: ReturnType<typeof createTestDependencies>;

beforeEach(async () => {
  await resetEmulators();
  tmdb = fakeTmdb({
    201: {
      title: 'Continuação da Saga',
      genres: ['Terror'],
      collection: { id: 50, name: 'Saga de Teste' },
      year: 1981,
    },
    204: { genres: ['Terror'], keywords: ['zombie'], year: 1980 },
    205: { genres: ['Terror', 'Comédia'], keywords: ['zombie'], year: 1988 },
    206: { genres: ['Comédia'], year: 1990 },
    207: { genres: ['Comédia'], keywords: ['road trip'], year: 2000 },
    208: { genres: ['Drama'], year: 2004 },
    209: { genres: ['Romance'], keywords: ['wedding'], year: 2011 },
    210: { genres: ['Romance'], year: 2016 },
    211: {
      title: 'Outro da Diretora',
      genres: ['Terror'],
      directors: [{ id: 900, name: 'Diretora Recorrente' }],
      year: 1990,
    },
  });
  gemini = createFakeGemini();
  dependencies = createTestDependencies(tmdb.fetch, () => clock, { gemini: gemini.client });
  await seedList(dependencies.db, UID, clock);
});

const readRecsDoc = async (): Promise<RecsDoc> => {
  const snapshot = await dependencies.db.doc(`lists/${LIST_ID}/recs/current`).get();
  return RecsDocSchema.parse(snapshot.data());
};

describe('runRecs', () => {
  test('grava recs/current com candidatos do TMDb, sem os da lista, da fila e de "Não quero"', async () => {
    // Primeiro a tradução das palavras-chave do modelo, depois os motivos.
    gemini.replies.push({ labels: [{ name: 'zombie', label: 'zumbis' }] });
    gemini.replies.push({ reasons: [{ tmdbId: 201, reason: 'Continua a saga que vocês puseram no topo da lista' }] });
    const report = await runRecs(dependencies, new UsageMeter());

    assert.deepEqual(report.failed, []);
    assert.equal(report.lists[0]?.status, 'written');
    const recs = await readRecsDoc();
    const ids = recs.items.map((item) => item.tmdbId);
    for (const excluded of [101, 102, 103, 104, 105, 106, 202, 203]) assert.ok(!ids.includes(excluded), `${excluded}`);
    assert.ok(ids.includes(201) && ids.includes(211));
    assert.ok(recs.items.length <= 30 && recs.trending.length <= 15 && recs.trending.length > 0);
    assert.equal(recs.modelVersion, 'pairwise-logit-v1');
    assert.equal(recs.model.labels?.zombie, 'zumbis');
    assert.equal((await dependencies.db.doc('keywordLabels/zombie').get()).get('label'), 'zumbis');
    assert.ok(Object.keys(recs.model.weights).length <= 300);

    const saga = recs.items.find((item) => item.tmdbId === 201);
    assert.equal(saga?.kind, 'saga');
    assert.equal(saga?.reason, 'Continua a saga que vocês puseram no topo da lista');
    assert.equal(saga?.reasonFrom[0], 'e101');
    assert.equal(saga?.reasonBy, 'gemini');
    const director = recs.items.find((item) => item.tmdbId === 211);
    assert.equal(director?.kind, 'diretor');
    assert.equal(director?.reason, 'Mesmo diretor de Topo da Saga (Diretora Recorrente), #1 na lista de vocês');
    assert.equal(director?.reasonBy, 'rules');
    for (const item of [...recs.items, ...recs.trending]) {
      assert.ok(Number.isInteger(item.score) && item.score >= 0 && item.score <= 100);
      assert.ok(item.reason.length > 0);
    }
    for (const item of recs.trending) assert.ok(item.source === 'trending' || item.source === 'nowPlaying');
    for (const item of recs.trending) assert.equal(item.kind, 'emAlta');

    // Um pedido ao Gemini para a lista, com o comentário sem o nome do membro; nada de OMDb nem Letterboxd.
    assert.equal(gemini.requests.length, 2);
    assert.ok(gemini.requests[0]?.prompt.includes('"zombie"'));
    assert.ok(!gemini.requests[1]?.prompt.includes('Joana'));
    assert.ok(gemini.requests[1]?.prompt.includes('a [nome] adorou os zumbis no shopping'));
    assert.deepEqual(tmdb.otherHosts, []);
    // Os filmes da lista estavam frescos: nenhum pedido ao TMDb por eles.
    for (const listed of [101, 102, 103, 104, 105, 106]) assert.ok(!tmdb.movieCalls.includes(listed));
    assert.ok(tmdb.listCalls.includes('trending'));
    assert.ok(tmdb.listCalls.some((call) => call.includes('with_release_type=2%7C3')));
  });

  test('rodar de novo troca o documento sem pedir de novo os filmes já guardados', async () => {
    await runRecs(dependencies, new UsageMeter());
    const first = await readRecsDoc();
    const movieCalls = tmdb.movieCalls.length;

    await runRecs(dependencies, new UsageMeter());
    const second = await readRecsDoc();
    assert.equal(tmdb.movieCalls.length, movieCalls);
    assert.deepEqual(
      second.items.map((item) => [item.tmdbId, item.score]),
      first.items.map((item) => [item.tmdbId, item.score]),
    );
    const docs = await dependencies.db.collection(`lists/${LIST_ID}/recs`).get();
    assert.equal(docs.size, 1);
  });

  test('próximo filme ainda não visto da saga começada pela lista, por data de estreia, já lançado', async () => {
    // 101 (na lista) é de 1978; 212 vem antes de 201 pela data; 213 ainda não estreou.
    tmdb = fakeTmdb(
      {
        212: { title: 'Entre os Dois', genres: ['Terror'], collection: { id: 50, name: 'Saga de Teste' }, year: 1980 },
      },
      {
        50: {
          parts: [
            { id: 201, title: 'Continuação da Saga', release_date: '1981-05-01' },
            { id: 213, title: 'Ainda Não Estreou', release_date: '2027-05-01' },
            { id: 101, title: 'Topo da Saga', release_date: '1978-05-01' },
            { id: 212, title: 'Entre os Dois', release_date: '1980-05-01' },
          ],
        },
      },
    );
    dependencies = createTestDependencies(tmdb.fetch, () => clock, { gemini: gemini.client });
    await runRecs(dependencies, new UsageMeter());

    assert.deepEqual(tmdb.collectionCalls, [50]);
    const saga = (await readRecsDoc()).items.find((item) => item.tmdbId === 212);
    assert.equal(saga?.kind, 'saga');
    assert.equal(saga?.reasonFrom[0], 'e101');
    assert.ok(!tmdb.movieCalls.includes(213));
  });

  test('respeita o limite de pedidos ao TMDb da execução', async () => {
    await runRecs(dependencies, new UsageMeter(), { ...DEFAULT_RECS_LIMITS, tmdbCalls: 3, batchSize: 1 });
    assert.ok(tmdb.movieCalls.length <= 3, `pedidos: ${tmdb.movieCalls.length}`);
  });

  test('lista sem filmes fica sem documento', async () => {
    await dependencies.db.doc('lists/vazia').set({
      name: 'Vazia',
      description: '',
      ownerUid: UID,
      memberUids: [UID],
      createdAt: clock,
      updatedAt: clock,
    });
    const report = await runRecs(dependencies, new UsageMeter());
    assert.equal(report.lists.find((list) => list.listId === 'vazia')?.status, 'empty');
    assert.equal((await dependencies.db.doc('lists/vazia/recs/current').get()).exists, false);
  });
});

describe('onListChanged', () => {
  test('reajusta e repontua sem TMDb nem Gemini, mantém os motivos e tira o filme que entrou na lista', async () => {
    await runRecs(dependencies, new UsageMeter());
    const before = await readRecsDoc();
    const movieCalls = tmdb.movieCalls.length;
    const listCalls = tmdb.listCalls.length;
    const geminiCalls = gemini.requests.length;

    // 204 entra no topo da lista; o último sobe para o terceiro lugar.
    await dependencies.db
      .doc(`lists/${LIST_ID}/entries/e204`)
      .set({ tmdbId: 204, rankKey: 'a', comment: '', watchedOn: null });
    await dependencies.db.doc(`lists/${LIST_ID}/entries/e106`).update({ rankKey: 'a00' });
    await onListChanged(dependencies.db, LIST_ID);

    const after = await readRecsDoc();
    assert.equal(tmdb.movieCalls.length, movieCalls);
    assert.equal(tmdb.listCalls.length, listCalls);
    assert.equal(gemini.requests.length, geminiCalls);
    assert.ok(!after.items.some((item) => item.tmdbId === 204));
    assert.equal(after.computedAt.getTime(), before.computedAt.getTime());
    for (const item of after.items) {
      const old = before.items.find((previous) => previous.tmdbId === item.tmdbId);
      assert.equal(item.reason, old?.reason);
      assert.deepEqual(item.reasonFrom, old?.reasonFrom);
    }
  });

  test('sem recs/current não faz nada', async () => {
    await onListChanged(dependencies.db, LIST_ID);
    assert.equal((await dependencies.db.doc(`lists/${LIST_ID}/recs/current`).get()).exists, false);
  });
});

describe('GET /api/cron/recs', () => {
  const handler = () => recsCronRoute(() => dependencies);

  test('sem o segredo do cron: 401', async () => {
    const response = await handler()(getRequest('/api/cron/recs'));
    assert.equal(response.status, 401);
  });

  test('com o segredo: 200 com o relatório', async () => {
    const response = await handler()(
      getRequest('/api/cron/recs', { headers: { authorization: `Bearer ${TEST_CRON_SECRET}` } }),
    );
    assert.equal(response.status, 200);
    const report = (await response.json()) as { lists: { listId: string; status: string }[] };
    assert.deepEqual(
      report.lists.map(({ listId, status }) => ({ listId, status })),
      [{ listId: LIST_ID, status: 'written' }],
    );
  });
});
