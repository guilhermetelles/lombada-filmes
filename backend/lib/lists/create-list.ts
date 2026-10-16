import type { Firestore } from 'firebase-admin/firestore';
import type { CreatedInvite } from '../types/list.js';
import { newInvite, reserveInviteCode } from './invite-codes.js';
import { inviteDocument, newListDocument } from './list-repository.js';

/** Nome e descrição de uma lista nova, já validados. */
type NewList = { name: string; description: string };

/**
 * Cria uma lista com a pessoa como dona e única integrante, e o primeiro código de convite, numa
 * transação só: o app recebe o código pronto para mandar para a outra pessoa.
 *
 * @param db - Firestore.
 * @param ownerUid - Quem cria a lista.
 * @param newList - Nome e descrição, já validados.
 * @param now - Momento da criação.
 * @returns O id da lista, o código de convite e quando ele vence.
 * @throws {Error} Se não achar um código de convite livre (improvável; ver reserveInviteCode).
 */
async function createList(
  db: Firestore,
  ownerUid: string,
  { name, description }: NewList,
  now: Date,
): Promise<{ listId: string } & CreatedInvite> {
  const list = newListDocument(db);

  return db.runTransaction(async (transaction) => {
    const inviteCode = await reserveInviteCode(transaction, db);
    const invite = newInvite(list.id, ownerUid, now);

    transaction.create(list, { name, description, ownerUid, memberUids: [ownerUid], createdAt: now, updatedAt: now });
    transaction.create(inviteDocument(db, inviteCode), invite);
    return { listId: list.id, inviteCode, expiresAt: invite.expiresAt };
  });
}

export { createList };
