import type { ErrorCode } from '../types/http.js';
import type { SourceName } from '../types/sources.js';

/**
 * Erro esperado. Carrega o status HTTP e o código que o app recebe; só lib/http/error-response.ts
 * transforma um erro em resposta.
 */
export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly code: ErrorCode;

  /**
   * @param message - Mensagem do erro (vai para o app, a menos que publicMessage seja trocada).
   * @param options - Opções do Error, como `cause`.
   */
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }

  /**
   * Mensagem que pode ir para o app, sem detalhes internos.
   *
   * @returns A própria mensagem do erro.
   */
  get publicMessage(): string {
    return this.message;
  }
}

/** Entrada do pedido inválida (400). */
export class InvalidInputError extends AppError {
  readonly status = 400;
  readonly code = 'invalid_input';
}

/** Pedido sem token ou com token inválido (401). */
export class UnauthenticatedError extends AppError {
  readonly status = 401;
  readonly code = 'unauthenticated';
}

/** O recurso não existe, como um filme que o TMDb não tem (404). */
export class NotFoundError extends AppError {
  readonly status = 404;
  readonly code = 'not_found';
}

/** A pessoa está logada, mas não pode fazer isso, como apagar uma lista de que não é dona (403). */
export class ForbiddenError extends AppError {
  readonly status = 403;
  readonly code = 'forbidden';
}

/** O código de convite existe, mas passou dos 7 dias (410). */
export class InviteExpiredError extends AppError {
  readonly status = 410;
  readonly code = 'invite_expired';
}

/** Uma fonte externa falhou: rede, status inesperado ou resposta fora do formato (502). */
export class SourceUnavailableError extends AppError {
  readonly status = 502;
  readonly code = 'source_unavailable';

  constructor(
    readonly source: SourceName,
    detail: string,
    options?: ErrorOptions,
  ) {
    super(`${source}: ${detail}`, options);
  }

  /**
   * Esconde o motivo técnico da falha, que fica só no log.
   *
   * @returns "<fonte> indisponível".
   */
  override get publicMessage(): string {
    return `${this.source} indisponível`;
  }
}
