import type { Firestore } from 'firebase-admin/firestore';

const FIRESTORE_BATCH_LIMIT = 500;

/**
 * Apaga os códigos de convite que já venceram.
 *
 * @param db - Firestore.
 * @param now - Momento de referência.
 * @returns Quantos códigos foram apagados.
 */
async function deleteExpiredInvites(db: Firestore, now: Date): Promise<number> {
  const expired = await db.collection('invites').where('expiresAt', '<=', now).get();
  for (let start = 0; start < expired.docs.length; start += FIRESTORE_BATCH_LIMIT) {
    const batch = db.batch();
    for (const invite of expired.docs.slice(start, start + FIRESTORE_BATCH_LIMIT)) batch.delete(invite.ref);
    await batch.commit();
  }
  return expired.size;
}

export { deleteExpiredInvites };
