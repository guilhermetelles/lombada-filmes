import { logger } from '../logging/logger.js';
import { createRetro } from '../retro/create-retro.js';
import { ListSchema } from '../schemas/list.js';
import { brazilDay, brazilMonth, isFirstDayOfMonth, previousMonth } from '../time/brazil-day.js';
import type { Dependencies } from '../types/dependencies.js';
import type { UsageRecorder } from '../types/usage.js';
import { closeMonthScores } from './close-month-scores.js';
import { createDailyQuiz } from './create-daily-quiz.js';
import { loadListMaterial } from './list-material.js';

/** Uma lista precisa de pelo menos 4 filmes para ter pergunta (4 alternativas). */
export const MIN_QUIZ_ENTRIES = 4;

/** Depois disso a rotina não começa lista nova (o limite da função é 300 s). */
const TIME_BUDGET_MS = 240_000;

/** Relatório da rotina quiz-and-month. */
export type QuizAndMonthReport = {
  day: string;
  lists: number; // listas com pelo menos 1 membro
  quizzes: { created: number; existing: number; withoutData: number };
  month: { month: string; closed: number; winnerItems: number; pushed: number; retros: number } | null; // só no dia 1
  failed: number; // listas com erro (registradas no log)
  skipped: number; // listas que ficaram para depois por falta de tempo
};

/**
 * Rotina das 05h30 de Brasília. Para cada lista com 1 ou mais membros: cria a pergunta do dia
 * (listas com 4 ou mais filmes). No dia 1 do mês, também fecha o placar do mês anterior (vencedores,
 * item da Atividade e aviso) e gera a retrospectiva dele. Tudo é idempotente: rodar de novo no mesmo
 * dia não troca a pergunta nem repete vencedor, retrospectiva, item ou aviso. Erro numa lista fica
 * no log e não impede as outras.
 *
 * @param dependencies - Banco, Gemini, FCM e relógio.
 * @param usage - Medidor de consumo da rotina.
 * @returns O relatório.
 */
async function runQuizAndMonth(dependencies: Dependencies, usage: UsageRecorder): Promise<QuizAndMonthReport> {
  const startedAt = Date.now();
  const today = dependencies.now();
  const day = brazilDay(today);
  const closing = isFirstDayOfMonth(today) ? previousMonth(brazilMonth(today)) : null;
  const report: QuizAndMonthReport = {
    day,
    lists: 0,
    quizzes: { created: 0, existing: 0, withoutData: 0 },
    month: closing ? { month: closing, closed: 0, winnerItems: 0, pushed: 0, retros: 0 } : null,
    failed: 0,
    skipped: 0,
  };

  const snapshot = await dependencies.db.collection('lists').get();
  for (const doc of snapshot.docs) {
    const parsed = ListSchema.safeParse(doc.data());
    if (!parsed.success) {
      logger.warn('lista fora do formato, fora do quiz', { listId: doc.id });
      continue;
    }
    const list = parsed.data;
    if (list.memberUids.length === 0) continue;
    report.lists++;
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      report.skipped++;
      continue;
    }

    try {
      const material = await loadListMaterial(dependencies.db, doc.id, list);
      if (material.entries.length >= MIN_QUIZ_ENTRIES) {
        const outcome = await createDailyQuiz(dependencies, usage, material, day);
        if (outcome === 'created') report.quizzes.created++;
        else if (outcome === 'exists') report.quizzes.existing++;
        else report.quizzes.withoutData++;
      }
      if (closing && report.month) {
        const scores = await closeMonthScores(dependencies, doc.id, list, closing);
        if (scores.closedNow) report.month.closed++;
        if (scores.feedCreated) report.month.winnerItems++;
        report.month.pushed += scores.pushed;
        if ((await createRetro(dependencies, usage, material, closing)) === 'created') report.month.retros++;
      }
    } catch (error) {
      report.failed++;
      logger.error('rotina quiz-and-month falhou numa lista', { listId: doc.id, error });
    }
  }
  return report;
}

export { runQuizAndMonth };
