import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import type { MemberProfile } from '../types/list.js';
import { listsCollection } from './list-repository.js';
import { isSameProfile, readMemberProfile } from './member-profiles.js';
import { syncMemberProfile } from './sync-member-profiles.js';

/** Um perfil que faltava ou estava diferente numa lista. */
type ProfileChange = { listId: string; uid: string; profile: MemberProfile };

/** Resultado da migração. */
type MigrationReport = {
  lists: number; // listas lidas
  changes: ProfileChange[]; // perfis que faltavam ou mudaram
  written: number; // perfis gravados (0 em dryRun)
};

/**
 * Preenche memberProfiles de todas as listas com o nome e a foto atuais de cada membro no Firebase
 * Auth. Idempotente: só grava o que falta ou mudou, então rodar de novo não grava nada. Cada conta
 * é lida uma vez, mesmo em várias listas.
 *
 * @param dependencies - Firestore e Auth.
 * @param options - `dryRun`: só calcula o que mudaria, sem gravar.
 * @returns Listas lidas, perfis a mudar e quantos foram gravados.
 * @throws O erro do Auth, se alguma conta não puder ser lida.
 */
async function migrateMemberProfiles(
  { db, auth }: { db: Firestore; auth: Pick<Auth, 'getUser'> },
  { dryRun }: { dryRun: boolean },
): Promise<MigrationReport> {
  const lists = await listsCollection(db).get();
  const profiles = new Map<string, Promise<MemberProfile>>();
  const profileOf = (uid: string) => {
    const cached = profiles.get(uid) ?? readMemberProfile(auth, uid);
    profiles.set(uid, cached);
    return cached;
  };

  const changes: ProfileChange[] = [];
  for (const list of lists.docs) {
    const { memberUids, memberProfiles } = list.data();
    for (const uid of memberUids) {
      const profile = await profileOf(uid);
      if (!isSameProfile(memberProfiles?.[uid], profile)) changes.push({ listId: list.id, uid, profile });
    }
  }

  let written = 0;
  if (!dryRun) {
    for (const { listId, uid, profile } of changes) {
      if (await syncMemberProfile(db, listId, uid, profile)) written++;
    }
  }
  return { lists: lists.size, changes, written };
}

export { migrateMemberProfiles };
