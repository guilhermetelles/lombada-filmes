import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { getDuelRoute } from '../../api/lists/[listId]/duel/_get.js';
import { voteDuelRoute } from '../../api/lists/[listId]/duel/_vote.js';
import { pickDuelPair } from '../../lib/duel/pick-duel-pair.js';
import { DEFAULT_NOTIFY_PREFS } from '../../lib/notify/default-notify-prefs.js';
import { deviceTokenDocument, notifyStateDocument } from '../../lib/notify/notify-repository.js';
import type { DuelView } from '../../lib/types/duel.js';
import { SAMPLE_FILMS, seedSampleList } from '../quiz/quiz-samples.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators, signUp } from '../support/emulators.js';
import { createFakeMessaging, type FakeMessaging } from '../support/fake-messaging.js';
import { fakeSources } from '../support/fake-sources.js';
import { getRequest, jsonRequest, readErrorCode, withBearer } from '../support/requests.js';

type Person = { uid: string; idToken: string };

const LIST_ID = 'lista-duelo';
const TODAY = '2026-10-18';
/** Ids das entradas das amostras, na ordem do ranking. */
const ENTRY_IDS = SAMPLE_FILMS.map((film) => `entrada-${film.tmdbId}`);
/** Título de cada entrada. */
const TITLES = new Map(SAMPLE_FILMS.map((film) => [`entrada-${film.tmdbId}`, film.movie.title]));

let clock: Date;
let fcm: FakeMessaging;
let dependencies: ReturnType<typeof createTestDependencies>;
let ana: Person;
let bia: Person;
let outsider: Person;

/**
 * Abre o duelo de hoje.
 *
 * @param person - Quem abre.
 * @param query - Par da notificação, como query.
 * @returns A resposta da rota.
 */
function open(person: Person, query = ''): Promise<Response> {
  return getDuelRoute(() => dependencies)(getRequest(`/api/lists/${LIST_ID}/duel${query}`, withBearer(person.idToken)));
}

/**
 * Vota no duelo.
 *
 * @param person - Quem vota.
 * @param choice - Escolha (ou qualquer valor inválido).
 * @param day - Dia no caminho.
 * @returns A resposta da rota.
 */
function vote(person: Person, choice: unknown, day = TODAY): Promise<Response> {
  return voteDuelRoute(() => dependencies)(
    jsonRequest(`/api/lists/${LIST_ID}/duel/${day}/vote`, { choice }, person.idToken),
  );
}

/**
 * Ids das entradas na ordem do ranking gravado.
 *
 * @returns Os ids, do primeiro ao último.
 */
async function rankingIds(): Promise<string[]> {
  const snapshot = await dependencies.db.collection(`lists/${LIST_ID}/entries`).orderBy('rankKey').get();
  return snapshot.docs.map((doc) => doc.id);
}

/**
 * Mensagens que chegaram aos aparelhos de uma pessoa.
 *
 * @param person - Quem recebeu.
 * @returns As mensagens, na ordem.
 */
function sentTo(person: Person) {
  return fcm.sent.filter((message) => message.tokens.includes(`token-${person.uid}`));
}

beforeEach(async () => {
  await resetEmulators();
  clock = new Date('2026-10-18T15:00:00Z');
  fcm = createFakeMessaging();
  dependencies = createTestDependencies(fakeSources().fetch, () => clock, { messaging: fcm.messaging });
  [ana, bia, outsider] = await Promise.all([
    signUp('ana@exemplo.com'),
    signUp('bia@exemplo.com'),
    signUp('de-fora@exemplo.com'),
  ]);
  await seedSampleList(dependencies.db, LIST_ID, [
    { uid: ana.uid, name: 'Ana Souza' },
    { uid: bia.uid, name: 'Bia Lima' },
  ]);
  for (const person of [ana, bia]) {
    await deviceTokenDocument(dependencies.db, person.uid, `token-${person.uid}`).set({
      token: `token-${person.uid}`,
      platform: 'android',
      updatedAt: clock,
    });
  }
});

describe('GET /api/lists/{listId}/duel', () => {
  test('sem par na rota: grava o sorteio do dia (o mesmo da notificação) e devolve o mesmo nas próximas', async () => {
    const [a, b] = pickDuelPair(ENTRY_IDS, TODAY, LIST_ID) ?? [];
    const response = await open(ana);

    assert.equal(response.status, 200);
    const expected: DuelView = { day: TODAY, entryIdA: a ?? '', entryIdB: b ?? '', status: 'open', votes: {} };
    assert.deepEqual(await response.json(), expected);
    assert.deepEqual(await (await open(bia, '?entryIdA=entrada-2756&entryIdB=entrada-2675')).json(), expected);
    assert.equal(
      (await dependencies.db.doc(`lists/${LIST_ID}/duels/${TODAY}`).get()).get('createdAt').toMillis(),
      clock.getTime(),
    );
  });

  test('par da notificação: usa as duas entradas, a de cima como A', async () => {
    const response = await open(ana, `?entryIdA=${ENTRY_IDS[4]}&entryIdB=${ENTRY_IDS[3]}`);
    const body = (await response.json()) as DuelView;
    assert.deepEqual([body.entryIdA, body.entryIdB], [ENTRY_IDS[3], ENTRY_IDS[4]]);
  });

  test('par da notificação com filme que saiu da lista: volta ao sorteio do dia', async () => {
    const [a] = pickDuelPair(ENTRY_IDS, TODAY, LIST_ID) ?? [];
    const body = (await (await open(ana, `?entryIdA=${ENTRY_IDS[0]}&entryIdB=sumiu`)).json()) as DuelView;
    assert.equal(body.entryIdA, a);
  });

  test('quem não é da lista: 403; lista com um filme só: 404', async () => {
    assert.equal(await readErrorCode(await open(outsider)), 'forbidden');
    await seedSampleList(dependencies.db, LIST_ID, [{ uid: ana.uid, name: 'Ana' }], []);
    assert.equal((await open(ana)).status, 200, 'o duelo de hoje já estava gravado');
    await dependencies.db.doc(`lists/${LIST_ID}/duels/${TODAY}`).delete();
    const entries = await dependencies.db.collection(`lists/${LIST_ID}/entries`).get();
    await Promise.all(entries.docs.slice(1).map((doc) => doc.ref.delete()));
    assert.equal(await readErrorCode(await open(ana)), 'not_found');
  });
});

describe('POST /api/lists/{listId}/duel/{dia}/vote', () => {
  /** Abre o duelo com as duas primeiras entradas. */
  async function openFirstPair(): Promise<void> {
    await open(ana, `?entryIdA=${ENTRY_IDS[0]}&entryIdB=${ENTRY_IDS[1]}`);
  }

  test('um voto para trocar não mexe na lista; quem não votou recebe o aviso, uma vez por dia', async () => {
    await openFirstPair();
    const response = await vote(ana, 'swap');

    assert.equal(response.status, 200);
    const body = (await response.json()) as DuelView;
    assert.deepEqual([body.status, body.votes], ['open', { [ana.uid]: 'swap' }]);
    assert.deepEqual(await rankingIds(), ENTRY_IDS);

    const [push] = sentTo(bia);
    assert.deepEqual(push?.notification, {
      title: 'Ana votou para trocar a ordem',
      body: `Vocês ainda acham que ${TITLES.get(ENTRY_IDS[0] ?? '')} é melhor que ${TITLES.get(ENTRY_IDS[1] ?? '')}?`,
    });
    assert.deepEqual(push?.android?.notification, { channelId: 'lista', tag: `duel-${LIST_ID}` });
    assert.equal(
      push?.data?.route,
      JSON.stringify({ name: 'duel', args: { entryId: ENTRY_IDS[0], entryIdB: ENTRY_IDS[1] } }),
    );
    assert.equal(sentTo(ana).length, 0, 'quem votou não recebe');

    await vote(ana, 'swap');
    assert.equal(sentTo(bia).length, 1, 'votar de novo não avisa de novo');
  });

  test('todos votam trocar: B passa na frente na mesma transação e os outros recebem o resultado', async () => {
    await openFirstPair();
    await vote(ana, 'swap');
    const response = await vote(bia, 'swap');

    const body = (await response.json()) as DuelView;
    assert.deepEqual([body.status, body.votes], ['swapped', { [ana.uid]: 'swap', [bia.uid]: 'swap' }]);
    assert.deepEqual(await rankingIds(), [ENTRY_IDS[1], ENTRY_IDS[0], ...ENTRY_IDS.slice(2)]);
    const moved = await dependencies.db.doc(`lists/${LIST_ID}/entries/${ENTRY_IDS[0]}`).get();
    assert.equal(moved.get('updatedBy'), bia.uid);

    const [result] = sentTo(ana);
    assert.deepEqual(result?.notification, {
      title: `${TITLES.get(ENTRY_IDS[1] ?? '')} passou para #1`,
      body: 'Todos votaram para trocar a ordem.',
    });
    assert.equal(sentTo(bia).length, 1, 'quem fechou só tinha o aviso do voto da Ana');
    assert.equal(await readErrorCode(await vote(ana, 'keep')), 'conflict');
  });

  test('um voto para manter fecha o duelo sem mexer na lista', async () => {
    await openFirstPair();
    await vote(ana, 'swap');
    const body = (await (await vote(bia, 'keep')).json()) as DuelView;

    assert.equal(body.status, 'kept');
    assert.deepEqual(await rankingIds(), ENTRY_IDS);
    assert.deepEqual(sentTo(ana)[0]?.notification, {
      title: 'Bia votou para manter',
      body: `${TITLES.get(ENTRY_IDS[0] ?? '')} continua na frente de ${TITLES.get(ENTRY_IDS[1] ?? '')}.`,
    });
    assert.equal(await readErrorCode(await vote(ana, 'swap')), 'conflict');
  });

  test('B já passou na frente (arrastada na lista): fecha como trocado sem mexer de novo', async () => {
    await openFirstPair();
    const first = await dependencies.db.doc(`lists/${LIST_ID}/entries/${ENTRY_IDS[0]}`).get();
    await dependencies.db.doc(`lists/${LIST_ID}/entries/${ENTRY_IDS[1]}`).update({ rankKey: '0' });
    await vote(ana, 'swap');
    await vote(bia, 'swap');

    assert.equal(
      (await dependencies.db.doc(`lists/${LIST_ID}/entries/${ENTRY_IDS[0]}`).get()).get('rankKey'),
      first.get('rankKey'),
    );
  });

  test('lista de uma pessoa só: o voto dela decide', async () => {
    await seedSampleList(dependencies.db, LIST_ID, [{ uid: ana.uid, name: 'Ana' }]);
    await openFirstPair();
    const body = (await (await vote(ana, 'swap')).json()) as DuelView;
    assert.equal(body.status, 'swapped');
    assert.equal(fcm.sent.length, 0);
  });

  test('quem desligou o duelo nas preferências não recebe', async () => {
    await notifyStateDocument(dependencies.db, bia.uid).set({
      prefs: { ...DEFAULT_NOTIFY_PREFS, types: { ...DEFAULT_NOTIFY_PREFS.types, duel: false } },
    });
    await openFirstPair();
    await vote(ana, 'swap');
    assert.equal(sentTo(bia).length, 0);
  });

  test('erros: outro dia, sem duelo aberto, escolha inválida e quem não é da lista', async () => {
    assert.equal(await readErrorCode(await vote(ana, 'swap', '2026-10-17')), 'not_today');
    assert.equal(await readErrorCode(await vote(ana, 'swap')), 'not_found');
    await openFirstPair();
    assert.equal(await readErrorCode(await vote(ana, 'trocar')), 'invalid_input');
    assert.equal(await readErrorCode(await vote(outsider, 'swap')), 'forbidden');
  });
});
