import { ForbiddenError, NotFoundError } from '../errors/app-errors.js';
import type { List } from '../types/list.js';

/**
 * Garante que a lista existe e que a pessoa é integrante dela.
 *
 * @param list - Lista lida do banco, ou undefined se não existir.
 * @param uid - Quem faz o pedido.
 * @returns A lista.
 * @throws {NotFoundError} Se a lista não existir.
 * @throws {ForbiddenError} Se a pessoa não for integrante.
 */
export function requireMember(list: List | undefined, uid: string): List {
  if (!list) throw new NotFoundError('lista não encontrada');
  if (!list.memberUids.includes(uid)) throw new ForbiddenError('você não participa desta lista');
  return list;
}

/**
 * Garante que a lista existe e que a pessoa é a dona.
 *
 * @param list - Lista lida do banco, ou undefined se não existir.
 * @param uid - Quem faz o pedido.
 * @returns A lista.
 * @throws {NotFoundError} Se a lista não existir.
 * @throws {ForbiddenError} Se a pessoa não for a dona.
 */
export function requireOwner(list: List | undefined, uid: string): List {
  if (!list) throw new NotFoundError('lista não encontrada');
  if (list.ownerUid !== uid) throw new ForbiddenError('só quem é dona da lista pode fazer isso');
  return list;
}
