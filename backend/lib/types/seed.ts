/** Um filme da lista original, como está no mock: posição, filme, data e comentário. */
export type OriginalEntry = {
  position: number;
  tmdbId: number;
  watchedOn: string | null; // AAAA-MM-DD
  comment: string;
};

/** Nome e descrição da lista original, como estão no mock. */
export type OriginalListInfo = {
  name: string;
  description: string;
};

/** Resultado da carga, para o script mostrar. */
export type SeedSummary = {
  listId: string;
  listCreated: boolean;
  entriesCreated: number;
  entriesKept: number;
  inviteCode: string;
  inviteExpiresAt: Date;
};
