import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { ROUTES } from '../../api/router.js';
import { dispatchRoute } from '../../lib/http/dispatch-route.js';
import type { Dependencies } from '../../lib/types/dependencies.js';
import type { RouteFactory, RouterEntry } from '../../lib/types/http.js';
import { getRequest } from '../support/requests.js';

/** Rota falsa que responde o próprio nome, sem tocar nas dependências. */
const answering =
  (name: string): RouteFactory =>
  () =>
  async () =>
    Response.json({ name });

/** Dependências que não devem ser montadas quando a rota não casa. */
const noDependencies = (): Dependencies => {
  throw new Error('dependências não deviam ser pedidas');
};

const TABLE: RouterEntry[] = [
  { name: 'queue-add', path: /^\/api\/lists\/[^/]+\/queue$/, methods: { POST: answering('queue-add') } },
  { name: 'queue-remove', path: /^\/api\/lists\/[^/]+\/queue\/[^/]+$/, methods: { DELETE: answering('queue-remove') } },
];

describe('dispatchRoute', () => {
  test('casa pelo caminho original', async () => {
    const response = await dispatchRoute(TABLE, 'DELETE', getRequest('/api/lists/abc/queue/603'), noDependencies);
    assert.deepEqual(await response.json(), { name: 'queue-remove' });
  });

  test('casa pelo nome do rewrite quando o caminho é /api/router', async () => {
    const response = await dispatchRoute(
      TABLE,
      'POST',
      getRequest('/api/router?route=queue-add&listId=abc'),
      noDependencies,
    );
    assert.deepEqual(await response.json(), { name: 'queue-add' });
  });

  test('rota ou método desconhecido: 404 not_found', async () => {
    const unknown = await dispatchRoute(TABLE, 'GET', getRequest('/api/router?route=nada'), noDependencies);
    assert.equal(unknown.status, 404);
    assert.equal(((await unknown.json()) as { error: { code: string } }).error.code, 'not_found');

    const wrongMethod = await dispatchRoute(TABLE, 'GET', getRequest('/api/lists/abc/queue'), noDependencies);
    assert.equal(wrongMethod.status, 404);
  });
});

describe('ROUTES de api/router.ts', () => {
  test('nomes únicos, e cada caminho casa com uma rota só', () => {
    const names = ROUTES.map((route) => route.name);
    assert.equal(new Set(names).size, names.length);

    const paths = [
      '/api/me/devices',
      '/api/me/notify',
      '/api/me/notify-test',
      '/api/discover',
      '/api/status',
      '/api/search/interpret',
      '/api/lists/abc/queue',
      '/api/lists/abc/queue/603',
      '/api/lists/abc/events',
      '/api/lists/abc/quiz/2026-10-18/answer',
      '/api/cron/enrich',
      '/api/cron/recs',
      '/api/cron/quiz-and-month',
      '/api/cron/notify-09',
      '/api/cron/notify-12',
      '/api/cron/notify-19',
      '/api/cron/notify-21',
    ];
    for (const path of paths) {
      assert.equal(ROUTES.filter((route) => route.path.test(path)).length, 1, path);
    }
  });

  test('cada rewrite do vercel.json leva a uma rota da tabela, e cada rotina tem rota', () => {
    const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')) as {
      rewrites: { source: string; destination: string }[];
      crons: { path: string }[];
    };
    const names = new Set(ROUTES.map((route) => route.name));
    for (const { destination } of config.rewrites) {
      const name = new URL(destination, 'http://localhost').searchParams.get('route');
      assert.ok(name && names.has(name), destination);
    }
    for (const { path } of config.crons) {
      if (path === '/api/cron/daily') continue; // função própria (api/cron/daily.ts)
      assert.ok(
        ROUTES.some((route) => route.path.test(path)),
        path,
      );
    }
  });
});
