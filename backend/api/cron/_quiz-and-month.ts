import { cronRoute } from '../../lib/http/cron-route.js';
import { logger } from '../../lib/logging/logger.js';
import { runQuizAndMonth } from '../../lib/quiz/run-quiz-and-month.js';

/**
 * GET /api/cron/quiz-and-month: rotina das 05h30 de Brasília (vercel.json). Cria o quiz do dia de
 * cada lista; no dia 1, fecha o placar do mês anterior, grava os vencedores, a retrospectiva, a
 * Atividade e o aviso do vencedor. Rodar de novo no mesmo dia não muda nada.
 *
 * Responde 200 com o relatório, ou 401 sem o segredo do cron.
 */
export const quizAndMonthCronRoute = cronRoute(async ({ dependencies, usage }) => {
  const report = await runQuizAndMonth(dependencies, usage);
  logger.info('rotina quiz-and-month concluída', { report });
  return Response.json(report);
});
