import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { registerDeviceRoute, unregisterDeviceRoute } from '../../api/me/_devices.js';
import { MAX_DEVICES_PER_PERSON } from '../../lib/notify/devices.js';
import { deviceTokenId } from '../../lib/notify/notify-repository.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators, signUp } from '../support/emulators.js';
import { fakeSources } from '../support/fake-sources.js';
import { jsonRequest, readErrorCode } from '../support/requests.js';

type Person = { uid: string; idToken: string };

let clock: Date;
let dependencies: ReturnType<typeof createTestDependencies>;
let ana: Person;

beforeEach(async () => {
  await resetEmulators();
  clock = new Date('2026-10-16T15:00:00Z');
  dependencies = createTestDependencies(fakeSources().fetch, () => clock);
  ana = await signUp('ana@exemplo.com');
});

const withDependencies = () => dependencies;
const register = (body: unknown, idToken: string | null = ana.idToken) =>
  registerDeviceRoute(withDependencies)(jsonRequest('/api/me/devices', body, idToken ?? undefined));
const unregister = (body: unknown) =>
  unregisterDeviceRoute(withDependencies)(
    new Request('http://localhost/api/me/devices', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ana.idToken}` },
      body: JSON.stringify(body),
    }),
  );
const tokensOf = async (uid: string) =>
  (await dependencies.db.collection(`devices/${uid}/tokens`).get()).docs.map((doc) => doc.get('token') as string);
const advanceClock = (ms: number) => {
  clock = new Date(clock.getTime() + ms);
};

describe('POST /api/me/devices', () => {
  test('grava o token em devices/{uid}/tokens/{sha256} com plataforma e updatedAt', async () => {
    const response = await register({ token: 'token-a', platform: 'android' });

    assert.equal(response.status, 204);
    const doc = await dependencies.db.doc(`devices/${ana.uid}/tokens/${deviceTokenId('token-a')}`).get();
    assert.equal(doc.get('token'), 'token-a');
    assert.equal(doc.get('platform'), 'android');
    assert.equal(doc.get('updatedAt').toMillis(), clock.getTime());
  });

  test('o mesmo token de novo só renova updatedAt', async () => {
    await register({ token: 'token-a', platform: 'android' });
    advanceClock(60_000);
    await register({ token: 'token-a', platform: 'android' });

    assert.deepEqual(await tokensOf(ana.uid), ['token-a']);
    const doc = await dependencies.db.doc(`devices/${ana.uid}/tokens/${deviceTokenId('token-a')}`).get();
    assert.equal(doc.get('updatedAt').toMillis(), clock.getTime());
  });

  test(`no máximo ${MAX_DEVICES_PER_PERSON} aparelhos: o sexto apaga o de updatedAt mais antigo`, async () => {
    for (const token of ['t1', 't2', 't3', 't4', 't5']) {
      await register({ token, platform: 'android' });
      advanceClock(60_000);
    }
    // t1 renovado passa a ser o mais novo; o mais antigo agora é t2.
    await register({ token: 't1', platform: 'android' });
    advanceClock(60_000);

    await register({ token: 't6', platform: 'android' });

    assert.deepEqual((await tokensOf(ana.uid)).sort(), ['t1', 't3', 't4', 't5', 't6']);
  });

  test('corpo inválido: 400', async () => {
    for (const body of [{ token: 'x' }, { token: '', platform: 'android' }, { token: 'x', platform: 'ios' }]) {
      const response = await register(body);
      assert.equal(response.status, 400, JSON.stringify(body));
      assert.equal(await readErrorCode(response), 'invalid_input');
    }
  });

  test('sem token de login: 401 e nada gravado', async () => {
    const response = await register({ token: 'token-a', platform: 'android' }, null);
    assert.equal(response.status, 401);
    assert.deepEqual(await tokensOf(ana.uid), []);
  });
});

describe('DELETE /api/me/devices', () => {
  test('esquece o token', async () => {
    await register({ token: 'token-a', platform: 'android' });
    await register({ token: 'token-b', platform: 'android' });

    assert.equal((await unregister({ token: 'token-a' })).status, 204);
    assert.deepEqual(await tokensOf(ana.uid), ['token-b']);
  });

  test('token que não estava registrado: 204', async () => {
    assert.equal((await unregister({ token: 'nunca-visto' })).status, 204);
  });

  test('sem token no corpo: 400', async () => {
    assert.equal((await unregister({})).status, 400);
  });
});
