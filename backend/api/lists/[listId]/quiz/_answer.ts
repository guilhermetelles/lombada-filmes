import { NotImplementedError } from '../../../../lib/errors/app-errors.js';
import { authenticatedRoute } from '../../../../lib/http/authenticated-route.js';
import { parseInput } from '../../../../lib/http/parse-input.js';
import { readJsonBody } from '../../../../lib/http/read-json-body.js';
import { readPathParam } from '../../../../lib/http/read-path-param.js';
import { QuizAnswerBody, QuizAnswerParams } from '../../../../lib/schemas/route-inputs.js';

/** Posição do dia em /api/lists/{listId}/quiz/{dia}/answer, contando "api" como 0. */
const DAY_POSITION = 4;

/**
 * POST /api/lists/{listId}/quiz/{dia}/answer: responde o quiz do dia numa transação (resposta,
 * correção pelo gabarito e placar do mês).
 *
 * Responde 200 `{ correct, rightOptionId, explanation, others }`, 400 se a entrada for inválida ou o
 * dia não for hoje em Brasília, 401 sem token válido, 403 para quem não é integrante, 404 sem quiz
 * no dia e 409 se a pessoa já respondeu. Esqueleto: responde 501.
 */
export const answerQuizRoute = authenticatedRoute(async ({ request }) => {
  const url = new URL(request.url);
  parseInput(QuizAnswerParams, { listId: readPathParam(url, 'listId'), day: readPathParam(url, 'day', DAY_POSITION) });
  await readJsonBody(request, QuizAnswerBody);
  throw new NotImplementedError('resposta do quiz não implementado');
});
