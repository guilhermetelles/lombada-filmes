import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { listEventsRoute } from '../../api/lists/[listId]/_events.js';
import { createListRoute } from '../../api/lists/index.js';
import { joinListRoute } from '../../api/lists/join.js';
import { DEFAULT_NOTIFY_PREFS } from '../../lib/notify/default-notify-prefs.js';
import { deviceTokenDocument, notifyStateDocument } from '../../lib/notify/notify-repository.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators, signUp } from '../support/emulators.js';
import { createFakeMessaging, type FakeMessaging } from '../support/fake-messaging.js';
import { fakeSources } from '../support/fake-sources.js';
import { jsonRequest, readErrorCode } from '../support/requests.js';

type Person = { uid: string; idToken: string };
type CreatedList = { listId: string; inviteCode: string };
type EventItem = { type: 'added' | 'moved' | 'commented'; entryId: string };

const MINUTE = 60_000;

let clock: Date;
let fcm: FakeMessaging;
let dependencies: ReturnType<typeof createTestDependencies>;
let ana: Person;
let bia: Person;
let outsider: Person;
let listId: string;

beforeEach(async () => {
  await resetEmulators();
  clock = new Date('2026-10-18T22:00:00Z');
  fcm = createFakeMessaging();
  dependencies = createTestDependencies(fakeSources().fetch, () => clock, { messaging: fcm.messaging });
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

  // Quatro entradas antigas, gravadas por Ana há dois dias; cada teste regrava as que "mexeu".
  const twoDaysAgo = new Date(clock.getTime() - 2 * 24 * 60 * MINUTE);
  await putEntry('e-speed', 1637, 'Speed', 'a1', { at: twoDaysAgo });
  await putEntry('e-abyss', 2756, 'The Abyss', 'a2', { at: twoDaysAgo });
  await putEntry('e-twister', 664, 'Twister', 'a3', { at: twoDaysAgo });
  await putEntry('e-heat', 949, 'Heat', 'a4', { at: twoDaysAgo });
  await deviceTokenDocument(dependencies.db, bia.uid, 'token-bia').set({
    token: 'token-bia',
    platform: 'android',
    updatedAt: clock,
  });
  await deviceTokenDocument(dependencies.db, ana.uid, 'token-ana').set({
    token: 'token-ana',
    platform: 'android',
    updatedAt: clock,
  });
});

const withDependencies = () => dependencies;

/**
 * Grava uma entrada direto no banco, como o app grava (as regras ficam de fora deste teste).
 *
 * @param entryId - Id da entrada.
 * @param tmdbId - Filme.
 * @param title - Título da cópia resumida.
 * @param rankKey - Chave de ordem.
 * @param options - Quem gravou, quem adicionou, comentário e quando.
 */
async function putEntry(
  entryId: string,
  tmdbId: number,
  title: string,
  rankKey: string,
  options: { by?: string; addedBy?: string; comment?: string; at?: Date } = {},
): Promise<void> {
  const by = options.by ?? ana.uid;
  const at = options.at ?? clock;
  await dependencies.db.doc(`lists/${listId}/entries/${entryId}`).set({
    tmdbId,
    rankKey,
    watchedOn: '2026-10-18',
    comment: options.comment ?? '',
    addedBy: options.addedBy ?? by,
    updatedBy: by,
    createdAt: at,
    updatedAt: at,
    movie: { title, year: null, posterPath: null, imdb: null, letterboxd: null, directors: [] },
  });
}

const send = (person: Person, items: EventItem[], id = listId) =>
  listEventsRoute(withDependencies)(jsonRequest(`/api/lists/${id}/events`, { items }, person.idToken));
const feedItems = async () =>
  (await dependencies.db.collection(`lists/${listId}/feed`).orderBy('createdAt').get()).docs.map((doc) => doc.data());
const sentTo = (token: string) => fcm.sent.filter((message) => message.tokens.includes(token));

describe('POST /api/lists/{listId}/events', () => {
  test('lote válido: 202, um item na Atividade com o resumo e um aviso agrupado para a outra pessoa', async () => {
    await putEntry('e-abyss', 2756, 'The Abyss', 'a2', { comment: 'Fundo do mar.' });
    await putEntry('e-heat', 949, 'Heat', 'a4');
    await putEntry('e-twister', 664, 'Twister', 'a3');

    const response = await send(ana, [
      { type: 'added', entryId: 'e-abyss' },
      { type: 'moved', entryId: 'e-heat' },
      { type: 'moved', entryId: 'e-twister' },
    ]);

    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { pushed: true });

    const feed = await feedItems();
    assert.equal(feed.length, 1);
    assert.deepEqual(
      {
        type: feed[0]?.type,
        kind: feed[0]?.kind,
        actorUid: feed[0]?.actorUid,
        title: feed[0]?.title,
        body: feed[0]?.body,
        quote: feed[0]?.quote,
        route: feed[0]?.route,
      },
      {
        type: 'member.activity',
        kind: 'lista',
        actorUid: ana.uid,
        title: 'Ana adicionou The Abyss e reordenou 2 filmes',
        body: 'Entrou em #2 de 4. Novas posições: Twister (#3) e Heat (#4).',
        quote: 'Fundo do mar.',
        route: { name: 'feed' },
      },
    );

    assert.equal(sentTo('token-ana').length, 0, 'quem mexeu não recebe aviso');
    const [push] = sentTo('token-bia');
    assert.deepEqual(push?.notification, {
      title: 'Ana adicionou The Abyss e reordenou 2 filmes',
      body: '“Fundo do mar.”',
    });
    assert.deepEqual(push?.android?.notification, { channelId: 'lista', tag: `activity-${listId}` });
    assert.equal(push?.data?.listId, listId);
    assert.ok(push?.data?.feedId);
  });

  test('agrupamento: outro lote dentro de 15 minutos grava a Atividade sem novo aviso; depois, avisa', async () => {
    await putEntry('e-heat', 949, 'Heat', 'a4');
    assert.deepEqual(await (await send(ana, [{ type: 'moved', entryId: 'e-heat' }])).json(), { pushed: true });

    clock = new Date(clock.getTime() + 10 * MINUTE);
    await putEntry('e-speed', 1637, 'Speed', 'a1', { comment: 'Ônibus.' });
    assert.deepEqual(await (await send(ana, [{ type: 'commented', entryId: 'e-speed' }])).json(), { pushed: false });
    assert.equal((await feedItems()).length, 2);
    assert.equal(sentTo('token-bia').length, 1);

    clock = new Date(clock.getTime() + 6 * MINUTE);
    await putEntry('e-twister', 664, 'Twister', 'a3');
    assert.deepEqual(await (await send(ana, [{ type: 'moved', entryId: 'e-twister' }])).json(), { pushed: true });
    assert.equal(sentTo('token-bia').length, 2);
  });

  test('sem agrupamento: avisa a cada lote, sem a tag, ainda com o máximo do dia', async () => {
    await notifyStateDocument(dependencies.db, bia.uid).set({
      prefs: { ...DEFAULT_NOTIFY_PREFS, activityGrouped: false },
    });
    await putEntry('e-heat', 949, 'Heat', 'a4');
    await send(ana, [{ type: 'moved', entryId: 'e-heat' }]);
    clock = new Date(clock.getTime() + MINUTE);
    await putEntry('e-twister', 664, 'Twister', 'a3');
    assert.deepEqual(await (await send(ana, [{ type: 'moved', entryId: 'e-twister' }])).json(), { pushed: true });

    const pushes = sentTo('token-bia');
    assert.equal(pushes.length, 2);
    assert.deepEqual(pushes[1]?.android?.notification, { channelId: 'lista' });
  });

  test('máximo de 6 avisos no dia de Brasília; no dia seguinte a contagem recomeça', async () => {
    await notifyStateDocument(dependencies.db, bia.uid).set({
      prefs: DEFAULT_NOTIFY_PREFS,
      pushesDay: '2026-10-18',
      pushesCount: 6,
    });
    await putEntry('e-heat', 949, 'Heat', 'a4');
    assert.deepEqual(await (await send(ana, [{ type: 'moved', entryId: 'e-heat' }])).json(), { pushed: false });
    assert.equal((await feedItems()).length, 1, 'a Atividade é gravada mesmo sem aviso');

    // 03:30 UTC do dia 19 já é dia 19 em Brasília.
    clock = new Date('2026-10-19T03:30:00Z');
    await putEntry('e-twister', 664, 'Twister', 'a3');
    assert.deepEqual(await (await send(ana, [{ type: 'moved', entryId: 'e-twister' }])).json(), { pushed: true });
    const state = (await notifyStateDocument(dependencies.db, bia.uid).get()).data();
    assert.deepEqual([state?.pushesDay, state?.pushesCount], ['2026-10-19', 1]);
    assert.deepEqual(state?.prefs, DEFAULT_NOTIFY_PREFS, 'as preferências ficam como estavam');
  });

  test('quem desligou os avisos de atividade não recebe; a Atividade é gravada', async () => {
    await notifyStateDocument(dependencies.db, bia.uid).set({ prefs: { ...DEFAULT_NOTIFY_PREFS, activity: false } });
    await putEntry('e-heat', 949, 'Heat', 'a4');

    assert.deepEqual(await (await send(ana, [{ type: 'moved', entryId: 'e-heat' }])).json(), { pushed: false });
    assert.equal(fcm.sent.length, 0);
    assert.equal((await feedItems())[0]?.title, 'Ana moveu Heat para #4');
  });

  test('ignora item de outra pessoa ou gravado há mais de 30 minutos; só eles: nada é gravado', async () => {
    await putEntry('e-heat', 949, 'Heat', 'a4', { by: bia.uid });
    await putEntry('e-twister', 664, 'Twister', 'a3', { at: new Date(clock.getTime() - 31 * MINUTE) });

    const response = await send(ana, [
      { type: 'moved', entryId: 'e-heat' },
      { type: 'moved', entryId: 'e-twister' },
      { type: 'commented', entryId: 'nao-existe' },
    ]);
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { pushed: false });
    assert.equal((await feedItems()).length, 0);
    assert.equal(fcm.sent.length, 0);

    await putEntry('e-speed', 1637, 'Speed', 'a1');
    await send(ana, [
      { type: 'moved', entryId: 'e-heat' },
      { type: 'moved', entryId: 'e-speed' },
    ]);
    assert.equal((await feedItems())[0]?.title, 'Ana moveu Speed para #1');
  });

  test('o comentário citado é o do banco, verbatim', async () => {
    await putEntry('e-speed', 1637, 'Speed', 'a1', { comment: '  Texto guardado, com “aspas” e espaços.  ' });
    await send(ana, [{ type: 'commented', entryId: 'e-speed' }]);
    const [item] = await feedItems();
    assert.equal(item?.quote, '  Texto guardado, com “aspas” e espaços.  ');
    assert.deepEqual(item?.route, { name: 'movie', args: { tmdbId: 1637 } });
  });

  test("'added' de filme que estava na fila tira o filme da fila", async () => {
    await dependencies.db.doc(`lists/${listId}/queue/2756`).set({ tmdbId: 2756, addedBy: bia.uid, createdAt: clock });
    await dependencies.db.doc(`lists/${listId}/queue/603`).set({ tmdbId: 603, addedBy: bia.uid, createdAt: clock });
    await putEntry('e-abyss', 2756, 'The Abyss', 'a2');

    await send(ana, [{ type: 'added', entryId: 'e-abyss' }]);

    assert.equal((await dependencies.db.doc(`lists/${listId}/queue/2756`).get()).exists, false);
    assert.equal((await dependencies.db.doc(`lists/${listId}/queue/603`).get()).exists, true);
  });

  test('acima de 30 lotes no dia: sem Atividade nem aviso, mas a fila ainda é limpa', async () => {
    await dependencies.db
      .doc(`rateLimits/${ana.uid}_2026-10-18`)
      .set({ uid: ana.uid, day: '2026-10-18', events: 30, updatedAt: clock });
    await dependencies.db.doc(`lists/${listId}/queue/2756`).set({ tmdbId: 2756, addedBy: bia.uid, createdAt: clock });
    await putEntry('e-abyss', 2756, 'The Abyss', 'a2');

    assert.deepEqual(await (await send(ana, [{ type: 'added', entryId: 'e-abyss' }])).json(), { pushed: false });
    assert.equal((await feedItems()).length, 0);
    assert.equal(fcm.sent.length, 0);
    assert.equal((await dependencies.db.doc(`lists/${listId}/queue/2756`).get()).exists, false);
  });

  test('conta os lotes em rateLimits/{uid}_{dia}.events, sem apagar a contagem do interpret', async () => {
    await dependencies.db
      .doc(`rateLimits/${ana.uid}_2026-10-18`)
      .set({ uid: ana.uid, day: '2026-10-18', interpret: 4, updatedAt: clock });
    await putEntry('e-heat', 949, 'Heat', 'a4');
    await send(ana, [{ type: 'moved', entryId: 'e-heat' }]);

    const counter = (await dependencies.db.doc(`rateLimits/${ana.uid}_2026-10-18`).get()).data();
    assert.deepEqual([counter?.interpret, counter?.events], [4, 1]);
  });

  test('quem não é integrante: 403; lista que não existe: 404; corpo inválido: 400', async () => {
    const forbidden = await send(outsider, [{ type: 'moved', entryId: 'e-heat' }]);
    assert.equal(forbidden.status, 403);
    assert.equal(await readErrorCode(forbidden), 'forbidden');

    assert.equal((await send(ana, [{ type: 'moved', entryId: 'e-heat' }], 'nao-existe')).status, 404);

    for (const items of [[], [{ type: 'deleted', entryId: 'e-heat' }], [{ type: 'moved', entryId: 'a/b' }]]) {
      const response = await listEventsRoute(withDependencies)(
        jsonRequest(`/api/lists/${listId}/events`, { items }, ana.idToken),
      );
      assert.equal(response.status, 400, JSON.stringify(items));
    }
    const tooMany = Array.from({ length: 51 }, () => ({ type: 'moved', entryId: 'e-heat' }));
    const response = await listEventsRoute(withDependencies)(
      jsonRequest(`/api/lists/${listId}/events`, { items: tooMany }, ana.idToken),
    );
    assert.equal(response.status, 400);
  });
});
