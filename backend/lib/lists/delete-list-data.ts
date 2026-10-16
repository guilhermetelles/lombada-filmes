import type { Firestore } from 'firebase-admin/firestore';

const FIRESTORE_BATCH_LIMIT = 500;

/**
 * Apaga uma lista por inteiro: os códigos de convite dela, as entradas e o próprio documento.
 * Não confere permissão; quem chama já conferiu.
 *
 * @param db - Firestore.
 * @param listId - Lista a apagar.
 */
async function deleteListData(db: Firestore, listId: string): Promise<void> {
  const invites = await db.collection('invites').where('listId', '==', listId).get();
  for (let start = 0; start < invites.docs.length; start += FIRESTORE_BATCH_LIMIT) {
    const batch = db.batch();
    for (const invite of invites.docs.slice(start, start + FIRESTORE_BATCH_LIMIT)) batch.delete(invite.ref);
    await batch.commit();
  }
  // Apaga o documento e todas as subcoleções (entries).
  await db.recursiveDelete(db.collection('lists').doc(listId));
}

export { deleteListData };
