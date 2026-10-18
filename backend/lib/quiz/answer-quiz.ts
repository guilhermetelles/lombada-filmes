import { FieldValue } from 'firebase-admin/firestore';
import { ConflictError, InvalidInputError, NotFoundError } from '../errors/app-errors.js';
import { writeFeedItem } from '../feed/write-feed-item.js';
import { requireMember } from '../lists/list-access.js';
import { listDocument } from '../lists/list-repository.js';
import { readMemberProfile } from '../lists/member-profiles.js';
import { logger } from '../logging/logger.js';
import { brazilDay } from '../time/brazil-day.js';
import type { Dependencies } from '../types/dependencies.js';
import type { List } from '../types/list.js';
import type { QuizAnswerResult, QuizOptionId } from '../types/quiz.js';
import { answersCollection, POINTS_PER_HIT, quizDocument, quizKeyDocument } from './quiz-repository.js';

/** O que responder: quem, em qual lista, de qual dia e qual alternativa. */
type AnswerRequest = { uid: string; listId: string; day: string; optionId: QuizOptionId };

/**
 * Responde a pergunta do dia numa transação: confere que a pessoa é membro, que a pergunta e o
 * gabarito existem e que ela ainda não respondeu; grava answers/{uid}, soma 10 pontos em
 * scores/{mês}.points.{uid} se acertou e devolve as respostas de quem já tinha respondido, lidas na
 * mesma transação. Depois, grava o item `quiz.result` da Atividade sem a alternativa escolhida.
 *
 * @param dependencies - Banco, Auth e relógio.
 * @param request - Quem responde, a lista, o dia e a alternativa.
 * @returns Se acertou, a alternativa certa, a explicação e as respostas dos outros.
 * @throws {InvalidInputError} Se o dia não for hoje em Brasília, ou se a alternativa não existir na pergunta.
 * @throws {NotFoundError} Se a lista não existir, ou se não houver pergunta (ou gabarito) no dia.
 * @throws {ForbiddenError} Se a pessoa não for integrante.
 * @throws {ConflictError} Se a pessoa já tiver respondido.
 */
async function answerQuiz(dependencies: Dependencies, request: AnswerRequest): Promise<QuizAnswerResult> {
  const { db, now } = dependencies;
  const { uid, listId, day, optionId } = request;
  if (day !== brazilDay(now())) throw new InvalidInputError('só dá para responder a pergunta de hoje');

  const answers = answersCollection(db, listId, day);
  const { list, result } = await db.runTransaction(async (transaction) => {
    const list = requireMember((await transaction.get(listDocument(db, listId))).data(), uid);
    const quiz = (await transaction.get(quizDocument(db, listId, day))).data();
    const key = (await transaction.get(quizKeyDocument(db, listId, day))).data();
    if (!quiz || !key) throw new NotFoundError('não há pergunta neste dia');
    const given = await transaction.get(answers);
    if (given.docs.some((answer) => answer.id === uid)) throw new ConflictError('você já respondeu a pergunta de hoje');
    if (!quiz.options.some((option) => option.id === optionId)) {
      throw new InvalidInputError('optionId não é uma alternativa da pergunta');
    }

    const correct = optionId === key.rightOptionId;
    transaction.create(answers.doc(uid), { optionId, correct, answeredAt: now() });
    if (correct) {
      transaction.set(
        db.doc(`lists/${listId}/scores/${day.slice(0, 7)}`),
        { points: { [uid]: FieldValue.increment(POINTS_PER_HIT) } },
        { merge: true },
      );
    }
    const others = given.docs.map((answer) => ({
      uid: answer.id,
      correct: answer.data().correct,
      optionId: answer.data().optionId,
    }));
    return { list, result: { correct, rightOptionId: key.rightOptionId, explanation: key.explanation, others } };
  });

  await writeResultFeed(dependencies, list, request, result.correct);
  return result;
}

/**
 * Grava o item `quiz.result` da Atividade (id `quiz-result-{dia}-{uid}`), dizendo só se a pessoa
 * acertou, sem a alternativa. A resposta já está gravada: uma falha aqui fica no log e não muda o
 * resultado da rota.
 *
 * @param dependencies - Banco, Auth e relógio.
 * @param list - Documento da lista (nomes dos membros).
 * @param request - Quem respondeu, a lista e o dia.
 * @param correct - Se acertou.
 */
async function writeResultFeed(
  { db, auth, now }: Dependencies,
  list: List,
  { uid, listId, day }: AnswerRequest,
  correct: boolean,
): Promise<void> {
  try {
    const name = list.memberProfiles?.[uid]?.name || (await readMemberProfile(auth, uid)).name;
    const verb = correct ? 'acertou' : 'errou';
    await writeFeedItem(
      db,
      listId,
      {
        type: 'quiz.result',
        kind: 'quiz',
        createdAt: now(),
        actorUid: uid,
        title: `${name || 'Alguém da lista'} ${verb} a pergunta de hoje`,
        route: { name: 'quizPlay', args: { day } },
      },
      `quiz-result-${day}-${uid}`,
    );
  } catch (error) {
    logger.warn('item quiz.result não gravado', { listId, uid, day, error });
  }
}

export { answerQuiz };
