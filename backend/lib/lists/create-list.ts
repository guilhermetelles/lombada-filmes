import type { Firestore } from 'firebase-admin/firestore';
import type { CreatedInvite } from '../types/list.js';
import { inviteExpiration, reserveInviteCode } from './invite-codes.js';
import { inviteDocument, newListDocument } from './list-repository.js';

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
    const expiresAt = inviteExpiration(now);

    transaction.create(list, { name, description, ownerUid, memberUids: [ownerUid], createdAt: now, updatedAt: now });
    transaction.create(inviteDocument(db, inviteCode), { listId: list.id, createdBy: ownerUid, expiresAt, usedBy: [] });
    return { listId: list.id, inviteCode, expiresAt };
  });
}

export { createList };
