import { AppError } from '../errors/app-errors.js';
import { logger } from '../logging/logger.js';
import type { ErrorBody, ErrorCode } from '../types/http.js';

/**
 * Converte qualquer erro numa resposta `{ error: { code, message } }`. Erros esperados (AppError)
 * levam o status e a mensagem pública deles; o resto vira 500 sem detalhes, que ficam só no log.
 *
 * @param error - O que a rota lançou.
 * @param request - Pedido, para registrar o caminho no log.
 * @returns Resposta de erro em JSON.
 */
export function errorResponse(error: unknown, request: Request): Response {
  const path = new URL(request.url).pathname;

  if (error instanceof AppError) {
    if (error.status >= 500) logger.error('falha numa fonte externa', { path, error });
    return errorBody(error.code, error.publicMessage, error.status);
  }

  logger.error('erro inesperado', { path, error });
  return errorBody('internal', 'erro interno', 500);
}

/**
 * Monta a resposta de erro no formato único do backend.
 *
 * @param code - Código que o app usa para decidir o que mostrar.
 * @param message - Mensagem que pode ir para o app.
 * @param status - Status HTTP.
 * @returns Resposta JSON.
 */
function errorBody(code: ErrorCode, message: string, status: number): Response {
  const body: ErrorBody = { error: { code, message } };
  return Response.json(body, { status });
}
