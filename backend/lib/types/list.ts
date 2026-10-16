/** De onde veio uma lista importada (só a lista original, gravada pelo script de carga). */
export type ListSource = {
  letterboxdUrl: string;
  importedAt: Date;
};

/** Documento lists/{listId}. */
export type List = {
  name: string;
  description: string;
  ownerUid: string;
  memberUids: string[];
  source?: ListSource | undefined;
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
