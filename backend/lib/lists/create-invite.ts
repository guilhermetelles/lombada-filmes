import type { Firestore } from 'firebase-admin/firestore';
import type { CreatedInvite } from '../types/list.js';
import { newInvite, reserveInviteCode } from './invite-codes.js';
import { requireMember } from './list-access.js';
import { inviteDocument, listDocument } from './list-repository.js';

/**
 * Gera um código de convite novo, de 7 dias, para uma lista. Qualquer integrante pode gerar.
 *
 * @param db - Firestore.
 * @param uid - Quem pede o código.
 * @param listId - Lista do convite.
 * @param now - Momento da criação.
 * @returns O código e quando ele vence.
 * @throws {NotFoundError} Se a lista não existir.
 * @throws {ForbiddenError} Se a pessoa não for integrante.
 * @throws {Error} Se não achar um código de convite livre (improvável; ver reserveInviteCode).
 */
async function createInvite(db: Firestore, uid: string, listId: string, now: Date): Promise<CreatedInvite> {
  return db.runTransaction(async (transaction) => {
    requireMember((await transaction.get(listDocument(db, listId))).data(), uid);
    const inviteCode = await reserveInviteCode(transaction, db);
    const invite = newInvite(listId, uid, now);

    transaction.create(inviteDocument(db, inviteCode), invite);
    return { inviteCode, expiresAt: invite.expiresAt };
  });
}

export { createInvite };
