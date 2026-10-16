import type { LetterboxdRating, OmdbRatings, Synopsis, TmdbMovie } from './sources.js';

// Documento movies/{tmdbId}: catálogo do filme e as quatro notas, cada uma com a data da busca.

export type Rating = {
  value: number | null;
  fetchedAt: Date;
};

export type MovieRatings = {
  letterboxd?: (Rating & { count: number | null }) | undefined;
  imdb?: (Rating & { votes: number | null }) | undefined;
  rottenTomatoes?: (Rating & { url: string | null }) | undefined;
  metacritic?: Rating | undefined;
};

export type Movie = {
  title: string;
  year: number | null;
  directors: string[];
  runtime: number | null;
  genres: string[];
  synopsis: Synopsis;
  posterPath: string | null;
  ids: { imdb: string | null; letterboxd: string | null };
  ratings: MovieRatings;
  tmdbFetchedAt: Date;
};

/**
 * Cópia resumida guardada em lists/{listId}/entries/{entryId}.movie, para a tela da lista abrir
 * lendo só as entradas. O formato é o que firestore.rules exige.
 */
export type MovieSnapshot = {
  title: string;
  year: number | null;
  posterPath: string | null;
  imdb: number | null;
  letterboxd: number | null;
};

/** O que cada fonte trouxe num pedido. Fica ausente quando a fonte estava fresca ou falhou. */
export type FetchedSources = {
  tmdb?: TmdbMovie | undefined;
  letterboxd?: LetterboxdRating | undefined;
  omdb?: OmdbRatings | undefined;
};
