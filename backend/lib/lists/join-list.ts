import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { InviteExpiredError, NotFoundError } from '../errors/app-errors.js';
import type { ListSummary, MemberProfile } from '../types/list.js';
import { inviteDocument, listDocument, memberProfileField } from './list-repository.js';

/**
 * Entra numa lista com um código de convite: confere o código, adiciona a pessoa em memberUids e o
 * perfil dela em memberProfiles, e registra o uso no convite, numa transação. Quem já é integrante só recebe a lista de volta,
 * mesmo com um código vencido.
 *
 * @param db - Firestore.
 * @param uid - Quem está entrando.
 * @param code - Código já normalizado (6 caracteres, maiúsculas).
 * @param now - Momento do pedido, para conferir a validade.
 * @param profile - Nome e foto de quem entra, lidos do Auth (readMemberProfile).
 * @returns Id, nome e descrição da lista, e se a pessoa já era integrante.
 * @throws {NotFoundError} Se o código não existir ou a lista dele tiver sido apagada.
 * @throws {InviteExpiredError} Se o código tiver passado dos 7 dias e a pessoa ainda não for integrante.
 */
async function joinList(
  db: Firestore,
  uid: string,
  code: string,
  now: Date,
  profile: MemberProfile,
): Promise<ListSummary & { alreadyMember: boolean }> {
  return db.runTransaction(async (transaction) => {
    const inviteRef = inviteDocument(db, code);
    const invite = (await transaction.get(inviteRef)).data();
    if (!invite) throw new NotFoundError('código de convite não encontrado');

    const listRef = listDocument(db, invite.listId);
    const list = (await transaction.get(listRef)).data();
    if (!list) throw new NotFoundError('a lista deste convite não existe mais');

    const summary = { listId: invite.listId, name: list.name, description: list.description };
    // Quem já é integrante só recebe a lista, mesmo com um código vencido.
    if (list.memberUids.includes(uid)) return { ...summary, alreadyMember: true };
    if (invite.expiresAt.getTime() <= now.getTime()) throw new InviteExpiredError('código de convite vencido');

    transaction.update(
      listRef,
      'memberUids',
      FieldValue.arrayUnion(uid),
      memberProfileField(uid),
      profile,
      'updatedAt',
      now,
    );
    transaction.update(inviteRef, { usedBy: FieldValue.arrayUnion(uid) });
    return { ...summary, alreadyMember: false };
  });
}

export { joinList };
