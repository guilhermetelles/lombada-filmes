import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { deviceTokenDocument, deviceTokensCollection } from '../../lib/notify/notify-repository.js';
import { sendFcm } from '../../lib/notify/send-fcm.js';
import type { PushMessage } from '../../lib/types/notify.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators } from '../support/emulators.js';
import { createFakeMessaging } from '../support/fake-messaging.js';
import { fakeSources } from '../support/fake-sources.js';

const { db } = createTestDependencies(fakeSources().fetch);
const updatedAt = new Date('2026-10-18T12:00:00Z');

/** Aviso de atividade, que substitui o anterior pela tag. */
const activityPush: PushMessage = {
  title: 'Nova atividade na lista',
  body: 'Duas mudanças na lista',
  listId: 'lista-1',
  feedId: 'feed-1',
  route: { name: 'feed' },
  channelId: 'lista',
  tag: 'activity-lista-1',
};

/**
 * Registra aparelhos de uma pessoa como a rota de devices grava.
 *
 * @param uid - Dona dos aparelhos.
 * @param tokens - Tokens do FCM.
 */
async function registerTokens(uid: string, tokens: string[]): Promise<void> {
  for (const token of tokens) await deviceTokenDocument(db, uid, token).set({ token, platform: 'android', updatedAt });
}

beforeEach(resetEmulators);

describe('sendFcm', () => {
  test('sem aparelhos não chama o FCM', async () => {
    const fcm = createFakeMessaging();

    assert.deepEqual(await sendFcm({ db, messaging: fcm.messaging }, 'pessoa-1', activityPush), {
      sent: 0,
      removed: 0,
    });
    assert.equal(fcm.sent.length, 0);
  });

  test('manda no formato do contrato §4 para todos os aparelhos', async () => {
    const fcm = createFakeMessaging();
    await registerTokens('pessoa-1', ['token-a', 'token-b']);

    const result = await sendFcm({ db, messaging: fcm.messaging }, 'pessoa-1', activityPush);

    assert.deepEqual(result, { sent: 2, removed: 0 });
    assert.equal(fcm.sent.length, 1);
    const message = fcm.sent[0];
    assert.deepEqual([...(message?.tokens ?? [])].sort(), ['token-a', 'token-b']);
    assert.deepEqual(message?.notification, { title: 'Nova atividade na lista', body: 'Duas mudanças na lista' });
    assert.deepEqual(message?.data, { listId: 'lista-1', feedId: 'feed-1', route: '{"name":"feed"}' });
    assert.deepEqual(message?.android, { notification: { channelId: 'lista', tag: 'activity-lista-1' } });
  });

  test('sem feedId nem tag, os campos ficam fora da mensagem', async () => {
    const fcm = createFakeMessaging();
    await registerTokens('pessoa-1', ['token-a']);

    await sendFcm({ db, messaging: fcm.messaging }, 'pessoa-1', {
      ...activityPush,
      feedId: undefined,
      tag: undefined,
      channelId: 'lembrete',
    });

    assert.deepEqual(fcm.sent[0]?.data, { listId: 'lista-1', route: '{"name":"feed"}' });
    assert.deepEqual(fcm.sent[0]?.android, { notification: { channelId: 'lembrete' } });
  });

  test('apaga os tokens que o FCM diz não estarem mais registrados', async () => {
    const fcm = createFakeMessaging();
    fcm.unregistered.add('token-velho');
    await registerTokens('pessoa-1', ['token-velho', 'token-novo']);

    const result = await sendFcm({ db, messaging: fcm.messaging }, 'pessoa-1', activityPush);

    assert.deepEqual(result, { sent: 1, removed: 1 });
    const remaining = await deviceTokensCollection(db, 'pessoa-1').get();
    assert.deepEqual(
      remaining.docs.map((doc) => doc.data().token),
      ['token-novo'],
    );
  });
});
