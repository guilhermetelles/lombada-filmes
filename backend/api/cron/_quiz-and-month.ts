import { cronRoute } from '../../lib/http/cron-route.js';
import { runJob } from '../../lib/jobs/job-health.js';
import { describeQuizAndMonth } from '../../lib/jobs/job-outcomes.js';
import { logger } from '../../lib/logging/logger.js';
import { runQuizAndMonth } from '../../lib/quiz/run-quiz-and-month.js';

/**
 * GET /api/cron/quiz-and-month: rotina das 05h30 de Brasília (vercel.json). Cria o quiz do dia de
 * cada lista e, todo dia, fecha o placar dos 2 meses anteriores que ainda não tenham vencedor
 * (vencedores, Atividade e aviso) e gera a retrospectiva que faltar. Rodar de novo não muda nada.
 *
 * Grava a saúde da execução em jobs/quiz-and-month. Responde 200 com o relatório, ou 401 sem o segredo
 * do cron.
 */
export const quizAndMonthCronRoute = cronRoute(async ({ dependencies, usage }) => {
  const report = await runJob(
    { dependencies, usage },
    'quiz-and-month',
    () => runQuizAndMonth(dependencies, usage),
    describeQuizAndMonth,
  );
  logger.info('rotina quiz-and-month concluída', { report });
  return Response.json(report);
});
