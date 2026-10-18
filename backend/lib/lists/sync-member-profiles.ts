import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import type { MemberProfile } from '../types/list.js';
import { listDocument, listsOfMember, memberProfileField } from './list-repository.js';
import { isSameProfile, readMemberProfile } from './member-profiles.js';

/**
 * Grava o perfil de um membro numa lista, só se ele mudou. Lê e grava numa transação: se a pessoa
 * saiu da lista nesse meio-tempo, nada é gravado (o perfil não volta para quem não é membro).
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @param uid - Membro.
 * @param profile - Nome e foto atuais.
 * @returns true se gravou; false se a lista não existe, a pessoa não é membro ou nada mudou.
 */
export async function syncMemberProfile(
  db: Firestore,
  listId: string,
  uid: string,
  profile: MemberProfile,
): Promise<boolean> {
  const listRef = listDocument(db, listId);
  return db.runTransaction(async (transaction) => {
    const list = (await transaction.get(listRef)).data();
    if (!list?.memberUids.includes(uid)) return false;
    if (isSameProfile(list.memberProfiles?.[uid], profile)) return false;

    transaction.update(listRef, memberProfileField(uid), profile);
    return true;
  });
}

/**
 * Copia o nome e a foto atuais do Google (Firebase Auth) para memberProfiles de todas as listas da
 * pessoa, gravando só onde mudou. Sem listas, nem lê o Auth.
 *
 * @param dependencies - Firestore e Auth.
 * @param uid - Pessoa.
 * @returns Em quantas listas o perfil foi gravado.
 * @throws O erro do Auth, se a conta não puder ser lida.
 */
export async function syncProfileInLists(
  { db, auth }: { db: Firestore; auth: Pick<Auth, 'getUser'> },
  uid: string,
): Promise<number> {
  const lists = await listsOfMember(db, uid).get();
  if (lists.empty) return 0;

  const profile = await readMemberProfile(auth, uid);
  const changed = lists.docs.filter((list) => !isSameProfile(list.data().memberProfiles?.[uid], profile));
  const written = await Promise.all(changed.map((list) => syncMemberProfile(db, list.id, uid, profile)));
  return written.filter(Boolean).length;
}
