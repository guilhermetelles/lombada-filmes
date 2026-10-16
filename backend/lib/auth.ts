import { auth } from './firestore.js';
import { HttpError } from './http.js';

// Lê `Authorization: Bearer <ID token do Firebase Auth>`, valida e devolve o uid.
export async function requireUid(request: Request): Promise<string> {
  const match = /^Bearer (\S+)$/.exec(request.headers.get('authorization') ?? '');
  if (!match) throw new HttpError(401, 'token ausente');
  try {
    const decoded = await auth().verifyIdToken(match[1]);
    return decoded.uid;
  } catch {
    throw new HttpError(401, 'token inválido');
  }
}
