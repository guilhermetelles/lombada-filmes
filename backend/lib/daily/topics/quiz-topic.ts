import { joinPt } from '../../notify/portuguese-text.js';
import { QuizDocSchema } from '../../schemas/quiz.js';
import type { DailyContent, DailyContext } from '../daily-content.js';

/**
 * Quiz do dia: só quando a rotina já gravou lists/{listId}/quizzes/{dia} e a pessoa ainda não
 * respondeu. O texto é o enunciado da pergunta e, se for o caso, quem da lista já respondeu (sem
 * dizer a resposta).
 *
 * @param context - Lista, pessoa e dia.
 * @returns A notificação, ou null sem quiz hoje ou com o quiz já respondido.
 */
async function composeQuiz({ dependencies, list, uid, day }: DailyContext): Promise<DailyContent | null> {
  const quizRef = dependencies.db.doc(`lists/${list.listId}/quizzes/${day}`);
  const quiz = QuizDocSchema.safeParse((await quizRef.get()).data());
  if (!quiz.success) return null;

  const answered = (await quizRef.collection('answers').select().get()).docs.map((doc) => doc.id);
  if (answered.includes(uid)) return null;

  const others = answered
    .filter((id) => list.list.memberUids.includes(id))
    .map((id) => list.list.memberProfiles?.[id]?.name ?? '')
    .filter((name) => name !== '');
  const verb = others.length > 1 ? 'já responderam' : 'já respondeu';
  return {
    type: 'daily.quiz',
    title: 'Quiz do dia',
    body: others.length > 0 ? `${quiz.data.prompt} ${joinPt(others)} ${verb}.` : quiz.data.prompt,
    route: { name: 'quizPlay', args: { day } },
  };
}

export { composeQuiz };
