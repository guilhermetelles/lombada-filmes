import { logger } from '../logging/logger.js';
import { createRetro } from '../retro/create-retro.js';
import { ListSchema } from '../schemas/list.js';
import { brazilDay, brazilMonth, previousMonth } from '../time/brazil-day.js';
import type { Dependencies } from '../types/dependencies.js';
import type { UsageRecorder } from '../types/usage.js';
import { closeMonthScores } from './close-month-scores.js';
import { createDailyQuiz } from './create-daily-quiz.js';
import { loadListMaterial } from './list-material.js';

/** Uma lista precisa de pelo menos 4 filmes para ter pergunta (4 alternativas). */
export const MIN_QUIZ_ENTRIES = 4;

/** Depois disso a rotina não começa lista nova (o limite da função é 300 s). */
const TIME_BUDGET_MS = 240_000;

/** Quantos meses para trás a rotina confere todo dia (placar fechado e retrospectiva). */
export const MONTHS_TO_CLOSE = 2;

/** O que a rotina fez com um mês já terminado, somando as listas. */
export type MonthReport = { month: string; closed: number; winnerItems: number; pushed: number; retros: number };

/** Relatório da rotina quiz-and-month. */
export type QuizAndMonthReport = {
  day: string;
  lists: number; // listas com pelo menos 1 membro
  quizzes: { created: number; existing: number; withoutData: number };
  months: MonthReport[]; // os 2 meses anteriores, do mais recente para o mais antigo
  failed: number; // listas com erro (registradas no log)
  skipped: number; // listas que ficaram para depois por falta de tempo
};

/**
 * Rotina das 05h30 de Brasília. Para cada lista com 1 ou mais membros: cria a pergunta do dia
 * (listas com 4 ou mais filmes). Todo dia, confere também os 2 meses anteriores: fecha o placar do
 * que ainda não tem `winnerUids` (vencedores, item da Atividade e aviso; só meses a partir da criação
 * da lista) e gera a retrospectiva que faltar. Assim, um dia 1 que falhou é coberto nos dias
 * seguintes. Tudo é idempotente: rodar de novo não troca a pergunta nem repete vencedor,
 * retrospectiva, item ou aviso. Erro numa lista fica no log e não impede as outras.
 *
 * @param dependencies - Banco, Gemini, FCM e relógio.
 * @param usage - Medidor de consumo da rotina.
 * @returns O relatório.
 */
async function runQuizAndMonth(dependencies: Dependencies, usage: UsageRecorder): Promise<QuizAndMonthReport> {
  const startedAt = Date.now();
  const today = dependencies.now();
  const day = brazilDay(today);
  const months: MonthReport[] = [];
  for (let month = brazilMonth(today); months.length < MONTHS_TO_CLOSE; ) {
    month = previousMonth(month);
    months.push({ month, closed: 0, winnerItems: 0, pushed: 0, retros: 0 });
  }
  const report: QuizAndMonthReport = {
    day,
    lists: 0,
    quizzes: { created: 0, existing: 0, withoutData: 0 },
    months,
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
      const createdMonth = brazilMonth(list.createdAt);
      for (const monthReport of months) {
        const { month } = monthReport;
        // Placar só existe a partir do mês em que a lista foi criada; a retrospectiva vale para
        // qualquer mês com filme visto (a lista pode ter vindo de outro lugar com datas antigas).
        if (month >= createdMonth) {
          const scores = await closeMonthScores(dependencies, doc.id, list, month);
          if (scores.closedNow) monthReport.closed++;
          if (scores.feedCreated) monthReport.winnerItems++;
          monthReport.pushed += scores.pushed;
        }
        if ((await createRetro(dependencies, usage, material, month)) === 'created') monthReport.retros++;
      }
    } catch (error) {
      report.failed++;
      logger.error('rotina quiz-and-month falhou numa lista', { listId: doc.id, error });
    }
  }
  return report;
}

export { runQuizAndMonth };
