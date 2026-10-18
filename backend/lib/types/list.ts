/** De onde veio uma lista importada (só a lista original, gravada pelo script de carga). */
export type ListSource = {
  letterboxdUrl: string;
  importedAt: Date;
};

/** Nome e foto de um membro, copiados da conta Google pelo backend. */
export type MemberProfile = {
  name: string;
  photoUrl: string | null;
};

/** lists/{listId}.memberProfiles: perfil de cada membro, por uid. */
export type MemberProfiles = Record<string, MemberProfile>;

/** Documento lists/{listId}. */
export type List = {
  name: string;
  description: string;
  ownerUid: string;
  memberUids: string[];
  source?: ListSource | undefined;
  memberProfiles?: MemberProfiles | undefined; // só o backend grava
  createdAt: Date;
  updatedAt: Date;
};

/** Documento invites/{code}: código para entrar numa lista, válido por 7 dias. */
export type Invite = {
  listId: string;
  createdBy: string;
  expiresAt: Date;
  usedBy: string[];
};

/** O que o app recebe ao entrar numa lista. */
export type ListSummary = {
  listId: string;
  name: string;
  description: string;
};

/** Código de convite recém-criado, como o app recebe. */
export type CreatedInvite = {
  inviteCode: string;
  expiresAt: Date;
};
