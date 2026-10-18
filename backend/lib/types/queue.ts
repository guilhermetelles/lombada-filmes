/** Documento lists/{listId}/queue/{tmdbId}: filme na fila "Quero ver" (só o backend grava). */
export type QueueItem = {
  tmdbId: number;
  addedBy: string;
  createdAt: Date;
};

/** Documento lists/{listId}/dismissed/{tmdbId}: sugestão marcada como "Não quero" (o app grava). */
export type Dismissed = {
  by: string;
  at: Date;
};
