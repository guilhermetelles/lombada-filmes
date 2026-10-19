import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { deviceTokenDocument, deviceTokensCollection } from '../../lib/notify/notify-repository.js';
import { PUSH_BODY_LIMIT, sendFcm, shortenBody } from '../../lib/notify/send-fcm.js';
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

  test('token inválido sai; invalid-argument (mensagem mal montada) não apaga o aparelho', async () => {
    const fcm = createFakeMessaging();
    fcm.failures.set('token-quebrado', 'messaging/invalid-registration-token');
    fcm.failures.set('token-bom', 'messaging/invalid-argument');
    await registerTokens('pessoa-1', ['token-quebrado', 'token-bom']);

    const result = await sendFcm({ db, messaging: fcm.messaging }, 'pessoa-1', activityPush);

    assert.deepEqual(result, { sent: 0, removed: 1 });
    const remaining = await deviceTokensCollection(db, 'pessoa-1').get();
    assert.deepEqual(
      remaining.docs.map((doc) => doc.data().token),
      ['token-bom'],
    );
  });

  test('comentário longo: o texto da notificação é cortado com reticências', async () => {
    const fcm = createFakeMessaging();
    await registerTokens('pessoa-1', ['token-a']);
    const long = `“${'Um comentário bem comprido sobre o filme. '.repeat(10).trim()}”`;

    await sendFcm({ db, messaging: fcm.messaging }, 'pessoa-1', { ...activityPush, body: long });

    const body = fcm.sent[0]?.notification?.body ?? '';
    assert.ok([...body].length <= PUSH_BODY_LIMIT, `tamanho ${body.length}`);
    assert.ok(body.endsWith('…'));
    assert.ok(long.startsWith(body.slice(0, -1)));
  });
});

describe('shortenBody', () => {
  test('texto curto fica igual', () => {
    assert.equal(shortenBody('Entrou em #3 de 200.'), 'Entrou em #3 de 200.');
  });

  test('corta no último espaço perto do limite, sem pontuação antes das reticências', () => {
    const words = 'palavra '.repeat(40).trim();
    const short = shortenBody(words);
    assert.ok([...short].length <= PUSH_BODY_LIMIT);
    assert.match(short, /palavra…$/);
  });

  test('sem espaço perto do fim, corta no limite', () => {
    const short = shortenBody('x'.repeat(400));
    assert.equal([...short].length, PUSH_BODY_LIMIT);
    assert.ok(short.endsWith('x…'));
  });
});
