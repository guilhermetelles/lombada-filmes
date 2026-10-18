import type { Firestore } from 'firebase-admin/firestore';
import type { CreatedInvite, MemberProfile } from '../types/list.js';
import { newInvite, reserveInviteCode } from './invite-codes.js';
import { inviteDocument, newListDocument } from './list-repository.js';

/** Nome e descrição de uma lista nova, já validados. */
type NewList = { name: string; description: string };

/**
 * Cria uma lista com a pessoa como dona e única integrante, já com o perfil dela em memberProfiles,
 * e o primeiro código de convite, numa transação só: o app recebe o código pronto para mandar para
 * a outra pessoa.
 *
 * @param db - Firestore.
 * @param ownerUid - Quem cria a lista.
 * @param newList - Nome e descrição, já validados.
 * @param now - Momento da criação.
 * @param ownerProfile - Nome e foto da dona, lidos do Auth (readMemberProfile).
 * @returns O id da lista, o código de convite e quando ele vence.
 * @throws {Error} Se não achar um código de convite livre (improvável; ver reserveInviteCode).
 */
async function createList(
  db: Firestore,
  ownerUid: string,
  { name, description }: NewList,
  now: Date,
  ownerProfile: MemberProfile,
): Promise<{ listId: string } & CreatedInvite> {
  const list = newListDocument(db);

  return db.runTransaction(async (transaction) => {
    const inviteCode = await reserveInviteCode(transaction, db);
    const invite = newInvite(list.id, ownerUid, now);

    transaction.create(list, {
      name,
      description,
      ownerUid,
      memberUids: [ownerUid],
      memberProfiles: { [ownerUid]: ownerProfile },
      createdAt: now,
      updatedAt: now,
    });
    transaction.create(inviteDocument(db, inviteCode), invite);
    return { listId: list.id, inviteCode, expiresAt: invite.expiresAt };
  });
}

export { createList };
