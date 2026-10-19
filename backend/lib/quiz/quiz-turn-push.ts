import { createIfAbsent } from '../firestore/idempotent.js';
import { logger } from '../logging/logger.js';
import { notifyLogDocument } from '../notify/notify-repository.js';
import { readNotifyPrefs } from '../notify/prefs.js';
import { sendFcm } from '../notify/send-fcm.js';
import type { Dependencies } from '../types/dependencies.js';
import type { List } from '../types/list.js';

/** Quem respondeu, em qual lista, de qual dia, com qual enunciado e quem já tinha respondido antes. */
export type QuizTurn = {
  uid: string;
  listId: string;
  day: string;
  prompt: string;
  answeredBefore: readonly string[];
};

/**
 * Avisa "Sua vez" aos outros membros quando alguém responde o quiz do dia: quem tem o quiz ligado e
 * ainda não respondeu recebe "{primeiro nome} respondeu o quiz de hoje. Sua vez!" com o enunciado,
 * abrindo a pergunta do dia, no canal quiz. Não diz se a pessoa acertou. No máximo um aviso por
 * pessoa por dia (notifyLog/{uid}_{dia}-quizturn, criado com create()). Uma falha com um membro vai
 * para o log e não impede os outros.
 *
 * @param dependencies - Banco, FCM e relógio.
 * @param list - Documento da lista (membros e nomes).
 * @param turn - Quem respondeu, a lista, o dia, o enunciado e quem já tinha respondido.
 * @returns Quantos membros foram avisados agora.
 */
async function pushQuizTurn(dependencies: Dependencies, list: List, turn: QuizTurn): Promise<number> {
  const { db, now } = dependencies;
  const { uid, listId, day, prompt, answeredBefore } = turn;
  const name = firstName(list.memberProfiles?.[uid]?.name ?? '');
  const title = `${name || 'Alguém da lista'} respondeu o quiz de hoje. Sua vez!`;
  const waiting = list.memberUids.filter((member) => member !== uid && !answeredBefore.includes(member));

  let pushed = 0;
  for (const member of waiting) {
    try {
      if (!(await readNotifyPrefs(db, member)).types.quiz) continue;
      const claimed = await createIfAbsent(notifyLogDocument(db, member, `${day}-quizturn`), {
        type: 'daily.quiz',
        listId,
        sentAt: now(),
      });
      if (!claimed) continue;
      await sendFcm(dependencies, member, {
        title,
        body: prompt,
        listId,
        feedId: `quiz-${day}`,
        route: { name: 'quizPlay', args: { day } },
        channelId: 'quiz',
      });
      pushed++;
    } catch (error) {
      logger.warn('aviso "Sua vez" do quiz não saiu', { listId, member, day, error });
    }
  }
  return pushed;
}

/**
 * Primeiro nome de um nome completo.
 *
 * @param name - Nome como está em memberProfiles.
 * @returns A primeira palavra, ou vazio.
 */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

export { pushQuizTurn };
