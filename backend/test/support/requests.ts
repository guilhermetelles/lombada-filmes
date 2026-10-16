// Monta pedidos para chamar as rotas direto, sem servidor.

/**
 * Monta um GET para chamar uma rota direto, sem servidor.
 *
 * @param path - Caminho com a query.
 * @param init - Cabeçalhos e outras opções.
 * @returns O pedido.
 */
export function getRequest(path: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost${path}`, init);
}

/**
 * Opções de pedido com o ID token no cabeçalho Authorization.
 *
 * @param idToken - Token devolvido por signUp.
 * @returns Opções para getRequest.
 */
export function withBearer(idToken: string): RequestInit {
  return { headers: { authorization: `Bearer ${idToken}` } };
}

/**
 * Lê o código de uma resposta de erro.
 *
 * @param response - Resposta da rota.
 * @returns O campo error.code.
 */
export async function readErrorCode(response: Response): Promise<string> {
  const body = (await response.json()) as { error: { code: string } };
  return body.error.code;
}
