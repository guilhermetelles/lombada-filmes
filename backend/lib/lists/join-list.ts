import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { InviteExpiredError, NotFoundError } from '../errors/app-errors.js';
import type { ListSummary } from '../types/list.js';
import { inviteDocument, listDocument } from './list-repository.js';

/**
 * Entra numa lista com um código de convite: confere o código, adiciona a pessoa em memberUids e
 * registra o uso no convite, numa transação. Quem já é integrante só recebe a lista de volta.
 *
 * @param db - Firestore.
 * @param uid - Quem está entrando.
 * @param code - Código já normalizado (6 caracteres, maiúsculas).
 * @param now - Momento do pedido, para conferir a validade.
 * @returns Id, nome e descrição da lista, e se a pessoa já era integrante.
 * @throws {NotFoundError} Se o código não existir ou a lista dele tiver sido apagada.
 * @throws {InviteExpiredError} Se o código tiver passado dos 7 dias.
 */
async function joinList(
  db: Firestore,
  uid: string,
  code: string,
  now: Date,
): Promise<ListSummary & { alreadyMember: boolean }> {
  return db.runTransaction(async (transaction) => {
    const inviteRef = inviteDocument(db, code);
    const invite = (await transaction.get(inviteRef)).data();
    if (!invite) throw new NotFoundError('código de convite não encontrado');
    if (invite.expiresAt.getTime() <= now.getTime()) throw new InviteExpiredError('código de convite vencido');

    const listRef = listDocument(db, invite.listId);
    const list = (await transaction.get(listRef)).data();
    if (!list) throw new NotFoundError('a lista deste convite não existe mais');

    const alreadyMember = list.memberUids.includes(uid);
    if (!alreadyMember) {
      transaction.update(listRef, { memberUids: FieldValue.arrayUnion(uid), updatedAt: now });
      transaction.update(inviteRef, { usedBy: FieldValue.arrayUnion(uid) });
    }
    return { listId: invite.listId, name: list.name, description: list.description, alreadyMember };
  });
}

export { joinList };
