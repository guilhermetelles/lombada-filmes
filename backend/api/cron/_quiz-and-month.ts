import { NotImplementedError } from '../../lib/errors/app-errors.js';
import { cronRoute } from '../../lib/http/cron-route.js';

/**
 * GET /api/cron/quiz-and-month: rotina das 05h30 de Brasília (vercel.json). Cria o quiz do dia de
 * cada lista; no dia 1, fecha o placar do mês anterior, grava os vencedores, a retrospectiva, a
 * Atividade e o aviso do vencedor.
 *
 * Responde 200 com o relatório, ou 401 sem o segredo do cron. Esqueleto: responde 501.
 */
export const quizAndMonthCronRoute = cronRoute(async () => {
  throw new NotImplementedError('rotina quiz-and-month não implementado');
});
