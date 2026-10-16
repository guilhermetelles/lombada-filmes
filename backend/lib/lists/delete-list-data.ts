import type { Firestore } from 'firebase-admin/firestore';
import { writeInBatches } from '../firestore/write-in-batches.js';
import { invitesOfList, listDocument } from './list-repository.js';

/**
 * Apaga uma lista por inteiro: os códigos de convite dela, as entradas e o próprio documento (se
 * ainda existir). Não confere permissão; quem chama já conferiu.
 *
 * @param db - Firestore.
 * @param listId - Lista a apagar.
 */
async function deleteListData(db: Firestore, listId: string): Promise<void> {
  const invites = await invitesOfList(db, listId).get();
  await writeInBatches(db, invites.docs, (batch, invite) => batch.delete(invite.ref));
  // Apaga o documento e todas as subcoleções (entries).
  await db.recursiveDelete(listDocument(db, listId));
}

export { deleteListData };
