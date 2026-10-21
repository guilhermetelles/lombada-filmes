import { NotFoundError } from '../errors/app-errors.js';
import { writeFeedItem } from '../feed/write-feed-item.js';
import { listDocument } from '../lists/list-repository.js';
import { sendFcm } from '../notify/send-fcm.js';
import { brazilDay } from '../time/brazil-day.js';
import type { Dependencies } from '../types/dependencies.js';
import type { QuizDoc, QuizType } from '../types/quiz.js';
import type { UsageRecorder } from '../types/usage.js';
import { QUIZ_GENERATORS } from './generate-daily-quiz.js';
import { LAUNCH_EVENT, LAUNCH_QUIZ_COUNT, launchQuizId } from './launch-event.js';
import { loadListMaterial } from './list-material.js';
import { quizDocument, quizKeyDocument } from './quiz-repository.js';
import { createSeededRandom, shuffle } from './seeded-random.js';

/** Id do item da Atividade que anuncia o evento; único por lista. */
const LAUNCH_FEED_ID = 'launch-inicio';

/** O que a criação do evento fez numa lista. */
export type LaunchEventReport = {
  created: { id: string; type: QuizType }[]; // perguntas gravadas agora
  existing: number; // perguntas que já existiam (execução repetida)
  pushed: number; // pessoas avisadas agora
};

/**
 * Cria o evento "Início de uso do app" numa lista: até 10 perguntas extras (`quizzes/inicio-01` a
 * `inicio-10`), cada uma de um tipo diferente, com o gabarito em `quizKeys`, um item na Atividade e
 * um aviso a cada integrante. Idempotente: pergunta que já existe não é trocada, e o aviso só sai
 * quando o item da Atividade é criado agora. Sem a pergunta do dia: o tipo de hoje fica por último.
 *
 * @param dependencies - Banco, fontes, FCM e relógio.
 * @param usage - Medidor de consumo (Gemini dos tipos que usam).
 * @param listId - Lista.
 * @returns As perguntas criadas, as que já existiam e quantas pessoas foram avisadas.
 * @throws {NotFoundError} Se a lista não existir.
 */
async function createLaunchEvent(
  dependencies: Dependencies,
  usage: UsageRecorder,
  listId: string,
): Promise<LaunchEventReport> {
  const { db, sources, now } = dependencies;
  const list = (await listDocument(db, listId).get()).data();
  if (!list) throw new NotFoundError('lista não encontrada');
  const material = await loadListMaterial(db, listId, list);
  const day = brazilDay(now());
  const todayType = (await quizDocument(db, listId, day).get()).data()?.type;

  const report: LaunchEventReport = { created: [], existing: 0, pushed: 0 };
  const used = new Set<QuizType>();
  for (let index = 1; index <= LAUNCH_QUIZ_COUNT; index++) {
    const id = launchQuizId(index);
    const stored = (await quizDocument(db, listId, id).get()).data();
    if (stored) {
      used.add(stored.type);
      report.existing++;
    }
  }

  const seed = `${LAUNCH_EVENT}|${listId}`;
  const types = shuffle(Object.keys(QUIZ_GENERATORS) as QuizType[], createSeededRandom(seed));
  const order = [...types.filter((type) => type !== todayType), ...types.filter((type) => type === todayType)];
  for (let index = 1; index <= LAUNCH_QUIZ_COUNT; index++) {
    const id = launchQuizId(index);
    const quizRef = quizDocument(db, listId, id);
    if ((await quizRef.get()).exists) continue;

    for (const type of order.filter((candidate) => !used.has(candidate))) {
      const random = createSeededRandom(`${seed}|${id}|${type}`);
      const generated = await QUIZ_GENERATORS[type]({ material, random, day, gemini: sources.gemini, usage });
      if (!generated) continue;
      used.add(type);
      const { rightOptionId, explanation, tmdbId, ...question } = generated;
      const quiz: QuizDoc = { day, ...question, createdAt: now(), event: LAUNCH_EVENT, eventIndex: index };
      const created = await db.runTransaction(async (transaction) => {
        if ((await transaction.get(quizRef)).exists) return false;
        transaction.create(quizRef, quiz);
        transaction.set(quizKeyDocument(db, listId, id), { rightOptionId, explanation, tmdbId });
        return true;
      });
      if (created) report.created.push({ id, type });
      break;
    }
  }

  const total = report.created.length + report.existing;
  if (total === 0) return report;
  const title = 'Início de uso do app!';
  const body = `${total} perguntas valendo pontos no placar do mês. Quem acerta mais?`;
  const route = { name: 'quiz' } as const;
  const { feedId, created } = await writeFeedItem(
    db,
    listId,
    { type: 'daily.quiz', kind: 'quiz', createdAt: now(), title, body, route },
    LAUNCH_FEED_ID,
  );
  if (!created) return report;
  for (const uid of list.memberUids) {
    const { sent } = await sendFcm(dependencies, uid, { title, body, listId, feedId, route, channelId: 'quiz' });
    if (sent > 0) report.pushed++;
  }
  return report;
}

export { createLaunchEvent };
