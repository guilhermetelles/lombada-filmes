import type { MovieSnapshot } from './movie.js';

/** Documento lists/{listId}/entries/{entryId}: um filme na lista. */
export type Entry = {
  tmdbId: number;
  rankKey: string; // chave de ordem fracionária (biblioteca fractional-indexing)
  watchedOn: string | null; // AAAA-MM-DD
  comment: string;
  addedBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  movie: MovieSnapshot;
};
