import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { answerQuizRoute } from '../../api/lists/[listId]/quiz/_answer.js';
import type { QuizAnswerResult } from '../../lib/types/quiz.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators, signUp } from '../support/emulators.js';
import { fakeSources } from '../support/fake-sources.js';
import { jsonRequest, readErrorCode } from '../support/requests.js';
import { seedSampleList } from './quiz-samples.js';

type Person = { uid: string; idToken: string };

const LIST_ID = 'lista-quiz';
const TODAY = '2026-10-18';
const EXPLANATION = 'The Abyss é de 1989. Direção de James Cameron.';

let clock: Date;
let dependencies: ReturnType<typeof createTestDependencies>;
let ana: Person;
let bia: Person;
let outsider: Person;

/**
 * Grava uma pergunta de teste e o gabarito dela (certa: b).
 *
 * @param day - Dia da pergunta.
 */
async function seedQuiz(day: string): Promise<void> {
  await dependencies.db.doc(`lists/${LIST_ID}/quizzes/${day}`).set({
    day,
    type: 'ano',
    prompt: 'Em que ano The Abyss foi lançado?',
    options: [
      { id: 'a', label: '1987' },
      { id: 'b', label: '1989' },
      { id: 'c', label: '1991' },
      { id: 'd', label: '1993' },
    ],
    createdAt: new Date(`${day}T08:30:00Z`),
  });
  await dependencies.db.doc(`lists/${LIST_ID}/quizKeys/${day}`).set({ rightOptionId: 'b', explanation: EXPLANATION });
}

/**
 * Chama a rota de resposta.
 *
 * @param person - Quem responde.
 * @param optionId - Alternativa (ou qualquer corpo inválido).
 * @param day - Dia no caminho.
 * @param listId - Lista no caminho.
 * @returns A resposta da rota.
 */
function answer(person: Person, optionId: unknown, day = TODAY, listId = LIST_ID): Promise<Response> {
  return answerQuizRoute(() => dependencies)(
    jsonRequest(`/api/lists/${listId}/quiz/${day}/answer`, { optionId }, person.idToken),
  );
}

/**
 * Lê um documento como objeto simples.
 *
 * @param path - Caminho do documento.
 * @returns Os dados, ou undefined.
 */
async function read(path: string) {
  return (await dependencies.db.doc(path).get()).data();
}

beforeEach(async () => {
  await resetEmulators();
  clock = new Date('2026-10-18T15:00:00Z');
  dependencies = createTestDependencies(fakeSources().fetch, () => clock);
  [ana, bia, outsider] = await Promise.all([
    signUp('ana@exemplo.com'),
    signUp('bia@exemplo.com'),
    signUp('de-fora@exemplo.com'),
  ]);
  await seedSampleList(dependencies.db, LIST_ID, [
    { uid: ana.uid, name: 'Ana' },
    { uid: bia.uid, name: 'Bia' },
  ]);
  await seedQuiz(TODAY);
});

describe('POST /api/lists/{listId}/quiz/{dia}/answer', () => {
  test('acerto: grava a resposta, soma 10 pontos e devolve a explicação, sem outras respostas', async () => {
    const response = await answer(ana, 'b');

    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()) as QuizAnswerResult, {
      correct: true,
      rightOptionId: 'b',
      explanation: EXPLANATION,
      others: [],
    });
    const saved = await read(`lists/${LIST_ID}/quizzes/${TODAY}/answers/${ana.uid}`);
    assert.deepEqual([saved?.optionId, saved?.correct, saved?.answeredAt.toMillis()], ['b', true, clock.getTime()]);
    assert.deepEqual(await read(`lists/${LIST_ID}/scores/2026-10`), { points: { [ana.uid]: 10 } });
  });

  test('erro: grava a resposta sem pontos', async () => {
    const response = await answer(bia, 'c');

    assert.equal(response.status, 200);
    const body = (await response.json()) as QuizAnswerResult;
    assert.deepEqual([body.correct, body.rightOptionId], [false, 'b']);
    assert.equal((await read(`lists/${LIST_ID}/quizzes/${TODAY}/answers/${bia.uid}`))?.correct, false);
    assert.equal(await read(`lists/${LIST_ID}/scores/2026-10`), undefined);
  });

  test('others traz só quem já respondeu, lido na mesma transação', async () => {
    await answer(ana, 'b');
    const response = await answer(bia, 'a');

    const body = (await response.json()) as QuizAnswerResult;
    assert.deepEqual(body.others, [{ uid: ana.uid, correct: true, optionId: 'b' }]);
  });

  test('os pontos somam aos do mês', async () => {
    await dependencies.db.doc(`lists/${LIST_ID}/scores/2026-10`).set({ points: { [ana.uid]: 20, [bia.uid]: 40 } });
    await answer(ana, 'b');
    assert.deepEqual(await read(`lists/${LIST_ID}/scores/2026-10`), { points: { [ana.uid]: 30, [bia.uid]: 40 } });
  });

  test('segunda resposta: 409, sem mudar resposta nem pontos', async () => {
    await answer(ana, 'b');
    const again = await answer(ana, 'a');

    assert.equal(again.status, 409);
    assert.equal((await read(`lists/${LIST_ID}/quizzes/${TODAY}/answers/${ana.uid}`))?.optionId, 'b');
    assert.deepEqual(await read(`lists/${LIST_ID}/scores/2026-10`), { points: { [ana.uid]: 10 } });
  });

  test('dia que não é hoje em Brasília: 400, sem gravar nada', async () => {
    await seedQuiz('2026-10-17');
    const response = await answer(ana, 'b', '2026-10-17');

    assert.equal(response.status, 400);
    assert.equal(await read(`lists/${LIST_ID}/quizzes/2026-10-17/answers/${ana.uid}`), undefined);
  });

  test('23h de Brasília ainda é o mesmo dia (02h UTC do dia seguinte)', async () => {
    clock = new Date('2026-10-19T02:00:00Z');
    const response = await answer(ana, 'b');
    assert.equal(response.status, 200);
  });

  test('item quiz.result na Atividade, sem a alternativa escolhida, uma vez por pessoa', async () => {
    await answer(ana, 'b');
    await answer(bia, 'd');

    const right = await read(`lists/${LIST_ID}/feed/quiz-result-${TODAY}-${ana.uid}`);
    assert.deepEqual(
      {
        type: right?.type,
        kind: right?.kind,
        actorUid: right?.actorUid,
        title: right?.title,
        route: right?.route,
        body: right?.body,
      },
      {
        type: 'quiz.result',
        kind: 'quiz',
        actorUid: ana.uid,
        title: 'Ana acertou a pergunta de hoje',
        route: { name: 'quizPlay', args: { day: TODAY } },
        body: undefined,
      },
    );
    assert.equal(
      (await read(`lists/${LIST_ID}/feed/quiz-result-${TODAY}-${bia.uid}`))?.title,
      'Bia errou a pergunta de hoje',
    );
    assert.equal((await dependencies.db.collection(`lists/${LIST_ID}/feed`).get()).size, 2);
  });

  test('quem não é integrante: 403', async () => {
    const response = await answer(outsider, 'b');
    assert.equal(response.status, 403);
    assert.equal(await readErrorCode(response), 'forbidden');
  });

  test('lista inexistente ou dia sem pergunta: 404', async () => {
    assert.equal((await answer(ana, 'b', TODAY, 'lista-que-nao-existe')).status, 404);
    await dependencies.db.doc(`lists/${LIST_ID}/quizzes/${TODAY}`).delete();
    const response = await answer(ana, 'b');
    assert.equal(response.status, 404);
    assert.equal(await readErrorCode(response), 'not_found');
  });

  test('alternativa fora de a–d ou dia mal escrito: 400', async () => {
    assert.equal((await answer(ana, 'e')).status, 400);
    assert.equal((await answer(ana, 'b', '18-10-2026')).status, 400);
  });

  test('sem token: 401', async () => {
    const response = await answerQuizRoute(() => dependencies)(
      jsonRequest(`/api/lists/${LIST_ID}/quiz/${TODAY}/answer`, { optionId: 'b' }),
    );
    assert.equal(response.status, 401);
  });
});
