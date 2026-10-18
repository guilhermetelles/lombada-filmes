import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { createListRoute } from '../../api/lists/index.js';
import { registerDeviceRoute } from '../../api/me/_devices.js';
import { getNotifyPrefsRoute, putNotifyPrefsRoute } from '../../api/me/_notify.js';
import { notifyTestRoute } from '../../api/me/_notify-test.js';
import { DEFAULT_NOTIFY_PREFS } from '../../lib/notify/default-notify-prefs.js';
import type { NotifyPrefs } from '../../lib/types/notify.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators, signUp } from '../support/emulators.js';
import { createFakeMessaging, type FakeMessaging } from '../support/fake-messaging.js';
import { fakeSources } from '../support/fake-sources.js';
import { getRequest, jsonRequest, readErrorCode, withBearer } from '../support/requests.js';

type Person = { uid: string; idToken: string };

const NOW = new Date('2026-10-16T15:00:00Z');

let fcm: FakeMessaging;
let dependencies: ReturnType<typeof createTestDependencies>;
let ana: Person;

beforeEach(async () => {
  await resetEmulators();
  fcm = createFakeMessaging();
  dependencies = createTestDependencies(fakeSources().fetch, () => NOW, { messaging: fcm.messaging });
  ana = await signUp('ana@exemplo.com');
});

const withDependencies = () => dependencies;
const getPrefs = () => getNotifyPrefsRoute(withDependencies)(getRequest('/api/me/notify', withBearer(ana.idToken)));
const putPrefs = (body: unknown) =>
  putNotifyPrefsRoute(withDependencies)(
    new Request('http://localhost/api/me/notify', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ana.idToken}` },
      body: JSON.stringify(body),
    }),
  );
const notifyTest = (idToken: string | null = ana.idToken) =>
  notifyTestRoute(withDependencies)(jsonRequest('/api/me/notify-test', {}, idToken ?? undefined));
const register = (token: string) =>
  registerDeviceRoute(withDependencies)(jsonRequest('/api/me/devices', { token, platform: 'android' }, ana.idToken));

const custom: NotifyPrefs = {
  ...DEFAULT_NOTIFY_PREFS,
  freq: 1,
  hour: 9,
  types: { ...DEFAULT_NOTIFY_PREFS.types, duel: false, birthday: false },
  activityGrouped: false,
};

describe('GET e PUT /api/me/notify', () => {
  test('sem nada gravado: o padrão (a cada 3 dias, 19h, tudo ligado)', async () => {
    const response = await getPrefs();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), DEFAULT_NOTIFY_PREFS);
  });

  test('PUT grava em notifyState/{uid}.prefs e o GET devolve o gravado', async () => {
    const response = await putPrefs(custom);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), custom);
    assert.deepEqual((await dependencies.db.doc(`notifyState/${ana.uid}`).get()).get('prefs'), custom);
    assert.deepEqual(await (await getPrefs()).json(), custom);
  });

  test('PUT mantém os limites de envio já gravados', async () => {
    await dependencies.db.doc(`notifyState/${ana.uid}`).set({
      prefs: DEFAULT_NOTIFY_PREFS,
      pushesDay: '2026-10-16',
      pushesCount: 2,
    });

    await putPrefs(custom);

    const state = (await dependencies.db.doc(`notifyState/${ana.uid}`).get()).data();
    assert.deepEqual([state?.pushesDay, state?.pushesCount, state?.prefs], ['2026-10-16', 2, custom]);
  });

  test('PUT inválido: 400 e nada gravado', async () => {
    const invalid = [
      { ...custom, freq: 2 },
      { ...custom, hour: 10 },
      { ...custom, types: { quiz: true } },
      { ...custom, activity: 'sim' },
      { freq: 1 },
    ];
    for (const body of invalid) {
      const response = await putPrefs(body);
      assert.equal(response.status, 400, JSON.stringify(body));
      assert.equal(await readErrorCode(response), 'invalid_input');
    }
    assert.equal((await dependencies.db.doc(`notifyState/${ana.uid}`).get()).exists, false);
  });

  test('sem token: 401', async () => {
    assert.equal((await getNotifyPrefsRoute(withDependencies)(getRequest('/api/me/notify'))).status, 401);
  });
});

describe('POST /api/me/notify-test', () => {
  test('sem aparelho registrado: { sent: 0 } e nada enviado', async () => {
    const response = await notifyTest();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { sent: 0 });
    assert.equal(fcm.sent.length, 0);
  });

  test('manda para todos os aparelhos, no canal lembrete, com a primeira lista da pessoa', async () => {
    const created = await createListRoute(withDependencies)(
      jsonRequest('/api/lists', { name: 'Maratona' }, ana.idToken),
    );
    const { listId } = (await created.json()) as { listId: string };
    await register('token-a');
    await register('token-b');

    const response = await notifyTest();

    assert.deepEqual(await response.json(), { sent: 2 });
    assert.equal(fcm.sent.length, 1);
    const [message] = fcm.sent;
    assert.deepEqual([...(message?.tokens ?? [])].sort(), ['token-a', 'token-b']);
    assert.equal(message?.android?.notification?.channelId, 'lembrete');
    assert.equal(message?.data?.listId, listId);
    assert.deepEqual(JSON.parse(message?.data?.route ?? '{}'), { name: 'feed' });
  });

  test('token recusado pelo FCM não conta e é apagado', async () => {
    await register('token-a');
    await register('token-velho');
    fcm.unregistered.add('token-velho');

    assert.deepEqual(await (await notifyTest()).json(), { sent: 1 });
    assert.equal((await dependencies.db.collection(`devices/${ana.uid}/tokens`).get()).size, 1);
  });

  test('sem token de login: 401', async () => {
    assert.equal((await notifyTest(null)).status, 401);
  });
});
