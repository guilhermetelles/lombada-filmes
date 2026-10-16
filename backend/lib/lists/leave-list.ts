import type { Firestore } from 'firebase-admin/firestore';
import { deleteListData } from './delete-list-data.js';
import { requireMember } from './list-access.js';
import { listDocument } from './list-repository.js';

/**
 * Tira a pessoa da lista. Se a dona sair, a posse passa para a próxima integrante, para a lista
 * nunca ficar sem ninguém que possa apagá-la. Se ninguém sobrar, a lista é apagada por inteiro.
 *
 * @param db - Firestore.
 * @param uid - Quem está saindo.
 * @param listId - Lista de onde sair.
 * @param now - Momento da saída.
 * @returns Se a lista foi apagada por ter ficado vazia.
 * @throws {NotFoundError} Se a lista não existir.
 * @throws {ForbiddenError} Se a pessoa não for integrante.
 */
async function leaveList(db: Firestore, uid: string, listId: string, now: Date): Promise<{ listDeleted: boolean }> {
  const listRef = listDocument(db, listId);

  const isNowEmpty = await db.runTransaction(async (transaction) => {
    const list = requireMember((await transaction.get(listRef)).data(), uid);
    const remaining = list.memberUids.filter((member) => member !== uid);
    const nextOwner = remaining.at(0);
    if (nextOwner === undefined) {
      // Apaga a lista já na transação: quem tentar entrar ou gerar convite agora recebe 404.
      transaction.delete(listRef);
      return true;
    }

    const ownerUid = list.ownerUid === uid ? nextOwner : list.ownerUid;
    transaction.update(listRef, { memberUids: remaining, ownerUid, updatedAt: now });
    return false;
  });

  // Entradas e convites vão depois, fora da transação (não cabem nela).
  if (isNowEmpty) await deleteListData(db, listId);
  return { listDeleted: isNowEmpty };
}

export { leaveList };
