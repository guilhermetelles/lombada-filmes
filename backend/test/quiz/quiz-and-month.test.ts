import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { quizAndMonthCronRoute } from '../../api/cron/_quiz-and-month.js';
import { SourceUnavailableError } from '../../lib/errors/app-errors.js';
import { DEFAULT_NOTIFY_PREFS } from '../../lib/notify/default-notify-prefs.js';
import { deviceTokenDocument, notifyStateDocument } from '../../lib/notify/notify-repository.js';
import type { QuizAndMonthReport } from '../../lib/quiz/run-quiz-and-month.js';
import type { GeminiClient } from '../../lib/types/sources.js';
import { createTestDependencies, TEST_CRON_SECRET } from '../support/dependencies.js';
import { resetEmulators } from '../support/emulators.js';
import { createFakeMessaging, type FakeMessaging } from '../support/fake-messaging.js';
import { fakeSources } from '../support/fake-sources.js';
import { getRequest } from '../support/requests.js';
import { SAMPLE_FILMS, seedSampleList } from './quiz-samples.js';

/** 05h30 de 18/10/2026 em Brasília, um dia comum. */
const ORDINARY_DAY = new Date('2026-10-18T08:30:00Z');
/** 05h30 de 01/10/2026 em Brasília: fecha setembro. */
const FIRST_OF_OCTOBER = new Date('2026-10-01T08:30:00Z');

/** Parágrafo que o Gemini falso devolve para a retrospectiva. */
const RETRO_TEXT = 'Setembro teve mergulho, plantação e câmera torta.';

const ANA = { uid: 'uid-ana', name: 'Ana' };
const BIA = { uid: 'uid-bia', name: 'Bia' };
const LIST_ID = 'lista-quiz';

let clock: Date;
let gemini: GeminiClient;
let fcm: FakeMessaging;

/**
 * Gemini falso que só responde à retrospectiva (o quiz fica com os tipos que não dependem dele).
 *
 * @param text - Parágrafo da retrospectiva; undefined faz a retrospectiva falhar também.
 * @returns O cliente.
 */
function retroOnlyGemini(text: string | undefined): GeminiClient {
  return {
    async generateJson({ system, schema }) {
      if (text && system?.includes('retrospectiva')) return schema.parse({ text });
      throw new SourceUnavailableError('gemini', 'fora do ar no teste');
    },
  };
}

const dependencies = () =>
  createTestDependencies(fakeSources().fetch, () => clock, { gemini, messaging: fcm.messaging });
const db = () => dependencies().db;

/**
 * Chama a rotina como o Vercel Cron.
 *
 * @returns O relatório.
 */
async function runRoutine(): Promise<QuizAndMonthReport> {
  const response = await quizAndMonthCronRoute(dependencies)(
    getRequest('/api/cron/quiz-and-month', { headers: { authorization: `Bearer ${TEST_CRON_SECRET}` } }),
  );
  assert.equal(response.status, 200);
  return (await response.json()) as QuizAndMonthReport;
}

/**
 * Lê um documento como objeto simples.
 *
 * @param path - Caminho do documento.
 * @returns Os dados, ou undefined.
 */
async function read(path: string) {
  return (await db().doc(path).get()).data();
}

/**
 * Registra um aparelho para a pessoa.
 *
 * @param uid - Pessoa.
 */
async function registerDevice(uid: string): Promise<void> {
  await deviceTokenDocument(db(), uid, `token-${uid}`).set({
    token: `token-${uid}`,
    platform: 'android',
    updatedAt: ORDINARY_DAY,
  });
}

beforeEach(async () => {
  await resetEmulators();
  clock = ORDINARY_DAY;
  gemini = retroOnlyGemini(RETRO_TEXT);
  fcm = createFakeMessaging();
  await seedSampleList(db(), LIST_ID, [ANA, BIA]);
});

describe('GET /api/cron/quiz-and-month: acesso', () => {
  test('sem o segredo do cron: 401', async () => {
    const response = await quizAndMonthCronRoute(dependencies)(getRequest('/api/cron/quiz-and-month'));
    assert.equal(response.status, 401);
  });
});

describe('GET /api/cron/quiz-and-month: pergunta do dia', () => {
  test('grava a pergunta, o gabarito e o item daily.quiz, mesmo com o Gemini fora do ar', async () => {
    const report = await runRoutine();

    assert.deepEqual(report.quizzes, { created: 1, existing: 0, withoutData: 0 });
    assert.equal(report.month, null);
    const quiz = await read(`lists/${LIST_ID}/quizzes/2026-10-18`);
    assert.equal(quiz?.day, '2026-10-18');
    assert.ok(!['emoji', 'sinopse'].includes(quiz?.type), 'sem Gemini, esses tipos ficam de fora');
    assert.deepEqual(
      quiz?.options.map((option: { id: string }) => option.id),
      ['a', 'b', 'c', 'd'],
    );
    assert.equal(quiz?.createdAt.toMillis(), ORDINARY_DAY.getTime());
    assert.equal(quiz?.rightOptionId, undefined, 'a resposta não fica na pergunta pública');

    const key = await read(`lists/${LIST_ID}/quizKeys/2026-10-18`);
    assert.ok(['a', 'b', 'c', 'd'].includes(key?.rightOptionId));
    assert.ok(key?.explanation);

    const feed = await read(`lists/${LIST_ID}/feed/quiz-2026-10-18`);
    assert.equal(feed?.type, 'daily.quiz');
    assert.equal(feed?.kind, 'quiz');
    assert.match(feed?.title, /^Pergunta de hoje: /);
    assert.equal(feed?.body, quiz?.prompt);
    assert.deepEqual(feed?.route, { name: 'quizPlay', args: { day: '2026-10-18' } });
  });

  test('rodar de novo no mesmo dia não troca a pergunta nem duplica o item', async () => {
    await runRoutine();
    const first = await read(`lists/${LIST_ID}/quizzes/2026-10-18`);
    const firstKey = await read(`lists/${LIST_ID}/quizKeys/2026-10-18`);

    clock = new Date(ORDINARY_DAY.getTime() + 60 * 60 * 1000);
    gemini = retroOnlyGemini('Outro texto.');
    const report = await runRoutine();

    assert.deepEqual(report.quizzes, { created: 0, existing: 1, withoutData: 0 });
    assert.deepEqual(await read(`lists/${LIST_ID}/quizzes/2026-10-18`), first);
    assert.deepEqual(await read(`lists/${LIST_ID}/quizKeys/2026-10-18`), firstKey);
    assert.equal((await db().collection(`lists/${LIST_ID}/feed`).get()).size, 1);
  });

  test('lista com menos de 4 filmes não tem pergunta; lista sem membros nem conta', async () => {
    await seedSampleList(db(), 'lista-curta', [ANA], SAMPLE_FILMS.slice(0, 3));
    await seedSampleList(db(), 'lista-vazia', [], SAMPLE_FILMS);

    const report = await runRoutine();

    assert.equal(report.lists, 2);
    assert.equal(report.quizzes.created, 1);
    assert.equal(await read('lists/lista-curta/quizzes/2026-10-18'), undefined);
    assert.equal(await read('lists/lista-vazia/quizzes/2026-10-18'), undefined);
  });

  test('o tipo de ontem vai para o fim do sorteio', async () => {
    await runRoutine();
    const firstType = (await read(`lists/${LIST_ID}/quizzes/2026-10-18`))?.type;

    // Mesmo dia e mesma lista, mas agora com uma pergunta desse tipo ontem.
    await db().doc(`lists/${LIST_ID}/quizzes/2026-10-18`).delete();
    await db()
      .doc(`lists/${LIST_ID}/quizzes/2026-10-17`)
      .set({
        day: '2026-10-17',
        type: firstType,
        prompt: 'Pergunta de ontem',
        options: [
          { id: 'a', label: '1' },
          { id: 'b', label: '2' },
        ],
        createdAt: ORDINARY_DAY,
      });
    await runRoutine();

    assert.notEqual((await read(`lists/${LIST_ID}/quizzes/2026-10-18`))?.type, firstType);
  });
});

describe('GET /api/cron/quiz-and-month: virada do mês', () => {
  beforeEach(() => {
    clock = FIRST_OF_OCTOBER;
  });

  test('fecha setembro com o vencedor, grava o item, avisa uma vez e gera a retrospectiva', async () => {
    await db()
      .doc(`lists/${LIST_ID}/scores/2026-09`)
      .set({ points: { [ANA.uid]: 30, [BIA.uid]: 20 } });
    await registerDevice(ANA.uid);
    await registerDevice(BIA.uid);

    const report = await runRoutine();

    assert.deepEqual(report.month, { month: '2026-09', closed: 1, winnerItems: 1, pushed: 2, retros: 1 });
    assert.deepEqual(await read(`lists/${LIST_ID}/scores/2026-09`), {
      points: { [ANA.uid]: 30, [BIA.uid]: 20 },
      winnerUids: [ANA.uid],
    });

    const winner = await read(`lists/${LIST_ID}/feed/quiz-winner-2026-09`);
    assert.equal(winner?.type, 'quiz.winner');
    assert.equal(winner?.title, 'Ana venceu o quiz de setembro de 2026');
    assert.equal(winner?.body, '30 pontos no placar do mês.');

    assert.equal(fcm.sent.length, 2);
    assert.deepEqual(fcm.sent[0]?.notification, { title: winner?.title, body: winner?.body });
    assert.equal(fcm.sent[0]?.android?.notification?.channelId, 'quiz');
    assert.equal(fcm.sent[0]?.data?.feedId, 'quiz-winner-2026-09');

    const retro = await read(`lists/${LIST_ID}/retros/2026-09`);
    assert.equal(retro?.month, '2026-09');
    assert.equal(retro?.films, 4);
    assert.equal(retro?.minutes, 140 + 106 + 116 + 118);
    assert.equal(retro?.bestEntryId, 'entrada-2756');
    assert.equal(retro?.worstEntryId, 'entrada-5491');
    assert.deepEqual(retro?.genres[0], { genre: 'Ficção científica', count: 3 });
    assert.equal(retro?.text, RETRO_TEXT);

    const retroItem = await read(`lists/${LIST_ID}/feed/retro-2026-09`);
    assert.equal(retroItem?.type, 'daily.retro');
    assert.equal(retroItem?.title, 'Retrospectiva de setembro de 2026');
    assert.equal(retroItem?.body, '4 filmes, 8 h. O mais bem colocado: The Abyss (#1).');
    assert.deepEqual(retroItem?.route, { name: 'retro', args: { month: '2026-09' } });

    // A pergunta do dia 1 também sai.
    assert.ok(await read(`lists/${LIST_ID}/quizzes/2026-10-01`));
  });

  test('rodar de novo no dia 1 não muda vencedor, retrospectiva, itens nem avisos', async () => {
    await db()
      .doc(`lists/${LIST_ID}/scores/2026-09`)
      .set({ points: { [ANA.uid]: 30, [BIA.uid]: 20 } });
    await registerDevice(ANA.uid);
    await runRoutine();
    const retro = await read(`lists/${LIST_ID}/retros/2026-09`);
    const feedSize = (await db().collection(`lists/${LIST_ID}/feed`).get()).size;

    // Uma resposta atrasada não reabre o mês.
    await db()
      .doc(`lists/${LIST_ID}/scores/2026-09`)
      .set({ points: { [BIA.uid]: 90 } }, { merge: true });
    gemini = retroOnlyGemini('Outro texto.');
    const report = await runRoutine();

    assert.deepEqual(report.month, { month: '2026-09', closed: 0, winnerItems: 0, pushed: 0, retros: 0 });
    assert.deepEqual((await read(`lists/${LIST_ID}/scores/2026-09`))?.winnerUids, [ANA.uid]);
    assert.deepEqual(await read(`lists/${LIST_ID}/retros/2026-09`), retro);
    assert.equal((await db().collection(`lists/${LIST_ID}/feed`).get()).size, feedSize);
    assert.equal(fcm.sent.length, 1);
  });

  test('empate: todos os empatados vencem', async () => {
    await db()
      .doc(`lists/${LIST_ID}/scores/2026-09`)
      .set({ points: { [ANA.uid]: 20, [BIA.uid]: 20 } });

    await runRoutine();

    assert.deepEqual((await read(`lists/${LIST_ID}/scores/2026-09`))?.winnerUids, [ANA.uid, BIA.uid]);
    const winner = await read(`lists/${LIST_ID}/feed/quiz-winner-2026-09`);
    assert.equal(winner?.title, 'Empate no quiz de setembro de 2026: Ana e Bia');
  });

  test('lista com 1 membro: placar fechado sem vencedor, sem item nem aviso', async () => {
    await seedSampleList(db(), LIST_ID, [ANA]);
    await db()
      .doc(`lists/${LIST_ID}/scores/2026-09`)
      .set({ points: { [ANA.uid]: 50 } });
    await registerDevice(ANA.uid);

    const report = await runRoutine();

    assert.deepEqual((await read(`lists/${LIST_ID}/scores/2026-09`))?.winnerUids, []);
    assert.equal(await read(`lists/${LIST_ID}/feed/quiz-winner-2026-09`), undefined);
    assert.equal(fcm.sent.length, 0);
    assert.equal(report.month?.closed, 1);
  });

  test('ninguém respondeu no mês: sem vencedor', async () => {
    await runRoutine();
    assert.deepEqual(await read(`lists/${LIST_ID}/scores/2026-09`), { points: {}, winnerUids: [] });
    assert.equal(await read(`lists/${LIST_ID}/feed/quiz-winner-2026-09`), undefined);
  });

  test('mês já fechado: winnerUids gravado não é trocado', async () => {
    await db()
      .doc(`lists/${LIST_ID}/scores/2026-09`)
      .set({ points: { [ANA.uid]: 90, [BIA.uid]: 10 }, winnerUids: [BIA.uid] });

    const report = await runRoutine();

    assert.equal(report.month?.closed, 0);
    assert.deepEqual((await read(`lists/${LIST_ID}/scores/2026-09`))?.winnerUids, [BIA.uid]);
  });

  test('quem desligou o quiz nas notificações não recebe o aviso do vencedor', async () => {
    await db()
      .doc(`lists/${LIST_ID}/scores/2026-09`)
      .set({ points: { [ANA.uid]: 30 } });
    await registerDevice(ANA.uid);
    await registerDevice(BIA.uid);
    await notifyStateDocument(db(), BIA.uid).set({
      prefs: { ...DEFAULT_NOTIFY_PREFS, types: { ...DEFAULT_NOTIFY_PREFS.types, quiz: false } },
    });

    await runRoutine();

    assert.deepEqual(
      fcm.sent.map((message) => message.tokens),
      [[`token-${ANA.uid}`]],
    );
  });

  test('Gemini fora do ar: a retrospectiva sai só com os números', async () => {
    gemini = retroOnlyGemini(undefined);
    await runRoutine();
    const retro = await read(`lists/${LIST_ID}/retros/2026-09`);
    assert.equal(retro?.films, 4);
    assert.equal(retro?.text, null);
  });

  test('mês sem filme visto: sem retrospectiva nem item', async () => {
    clock = new Date('2026-08-01T08:30:00Z');
    const report = await runRoutine();
    assert.equal(report.month?.month, '2026-07');
    assert.equal(report.month?.retros, 0);
    assert.equal(await read(`lists/${LIST_ID}/retros/2026-07`), undefined);
    assert.equal(await read(`lists/${LIST_ID}/feed/retro-2026-07`), undefined);
  });
});
