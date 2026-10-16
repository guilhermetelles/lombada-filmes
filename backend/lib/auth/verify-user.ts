import type { Auth } from 'firebase-admin/auth';
import { UnauthenticatedError } from '../errors/app-errors.js';

/** Cabeçalho `Authorization: Bearer <token>`; o grupo 1 é o token. */
const BEARER_TOKEN = /^Bearer (\S+)$/;

/**
 * Lê o cabeçalho `Authorization: Bearer <ID token do Firebase Auth>` e valida o token.
 *
 * @param auth - Auth do Admin SDK.
 * @param request - Pedido recebido pela rota.
 * @returns O uid de quem fez o pedido.
 * @throws {UnauthenticatedError} Se o cabeçalho faltar, não for Bearer ou o token for inválido.
 */
async function verifyUser(auth: Auth, request: Request): Promise<string> {
  const token = BEARER_TOKEN.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!token) throw new UnauthenticatedError('token ausente');

  try {
    const decoded = await auth.verifyIdToken(token);
    return decoded.uid;
  } catch (cause) {
    throw new UnauthenticatedError('token inválido', { cause });
  }
}

export { verifyUser };
