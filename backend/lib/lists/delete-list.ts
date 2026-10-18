import type { Firestore } from 'firebase-admin/firestore';
import { deleteListData } from './delete-list-data.js';
import { requireOwner } from './list-access.js';
import { listDocument } from './list-repository.js';

/**
 * Apaga uma lista, as entradas, a fila e os códigos de convite. Só a dona pode. Os perfis de
 * memberProfiles saem junto com o documento.
 *
 * @param db - Firestore.
 * @param uid - Quem pede a exclusão.
 * @param listId - Lista a apagar.
 * @throws {NotFoundError} Se a lista não existir.
 * @throws {ForbiddenError} Se a pessoa não for a dona.
 */
async function deleteList(db: Firestore, uid: string, listId: string): Promise<void> {
  const list = listDocument(db, listId);
  // Confere a dona e apaga a lista na mesma transação: quem tentar entrar ou gerar convite agora
  // recebe 404. Entradas e convites vão depois, fora da transação (não cabem nela).
  await db.runTransaction(async (transaction) => {
    requireOwner((await transaction.get(list)).data(), uid);
    transaction.delete(list);
  });
  await deleteListData(db, listId);
}

export { deleteList };
