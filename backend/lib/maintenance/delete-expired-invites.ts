import type { Firestore } from 'firebase-admin/firestore';
import { writeInBatches } from '../firestore/write-in-batches.js';
import { invitesCollection } from '../lists/list-repository.js';

/**
 * Apaga os códigos de convite que já venceram.
 *
 * @param db - Firestore.
 * @param now - Momento de referência.
 * @returns Quantos códigos foram apagados.
 */
async function deleteExpiredInvites(db: Firestore, now: Date): Promise<number> {
  const expired = await invitesCollection(db).where('expiresAt', '<=', now).get();
  await writeInBatches(db, expired.docs, (batch, invite) => batch.delete(invite.ref));
  return expired.size;
}

export { deleteExpiredInvites };
