import type { Auth, UserRecord } from 'firebase-admin/auth';
import type { MemberProfile } from '../types/list.js';

/** Tamanho máximo do endereço da foto guardado em memberProfiles. */
export const MAX_PHOTO_URL_LENGTH = 500;

/** Tamanho máximo do nome guardado em memberProfiles. */
export const MAX_MEMBER_NAME_LENGTH = 100;

/**
 * Monta o perfil de um membro a partir da conta do Firebase Auth (nome e foto do Google). O nome
 * vazio fica vazio (o app mostra a inicial do e-mail ou nada); a foto só vale se for https e tiver
 * até 500 caracteres.
 *
 * @param user - Conta lida do Auth.
 * @returns Nome e foto para lists/{listId}.memberProfiles.{uid}.
 */
export function toMemberProfile(user: Pick<UserRecord, 'displayName' | 'photoURL'>): MemberProfile {
  return {
    name: (user.displayName ?? '').trim().slice(0, MAX_MEMBER_NAME_LENGTH),
    photoUrl: validPhotoUrl(user.photoURL),
  };
}

/**
 * Lê nome e foto atuais da pessoa no Firebase Auth.
 *
 * @param auth - Auth do Admin SDK.
 * @param uid - Pessoa.
 * @returns O perfil, pronto para gravar.
 * @throws O erro do Auth, se a conta não existir ou a leitura falhar.
 */
export async function readMemberProfile(auth: Pick<Auth, 'getUser'>, uid: string): Promise<MemberProfile> {
  return toMemberProfile(await auth.getUser(uid));
}

/**
 * Diz se dois perfis são iguais, para só gravar quando algo mudou.
 *
 * @param stored - Perfil guardado na lista, ou undefined se ainda não houver.
 * @param current - Perfil atual.
 * @returns true se nome e foto forem iguais.
 */
export function isSameProfile(stored: MemberProfile | undefined, current: MemberProfile): boolean {
  return stored !== undefined && stored.name === current.name && stored.photoUrl === current.photoUrl;
}

/**
 * Confere o endereço da foto: só https e até 500 caracteres.
 *
 * @param photoUrl - Endereço vindo do Auth.
 * @returns O endereço, ou null se faltar ou não servir.
 */
function validPhotoUrl(photoUrl: string | undefined): string | null {
  if (!photoUrl || photoUrl.length > MAX_PHOTO_URL_LENGTH) return null;
  try {
    return new URL(photoUrl).protocol === 'https:' ? photoUrl : null;
  } catch {
    return null;
  }
}
