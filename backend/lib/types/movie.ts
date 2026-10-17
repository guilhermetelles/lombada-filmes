import type { CastMember, Director, PersonRef } from './person.js';
import type { LetterboxdRating, OmdbRatings, Synopsis, TmdbMovie } from './sources.js';

/** Documento movies/{tmdbId}: catálogo do filme e as quatro notas, cada uma com a data da busca. */

/** Uma nota e a data em que foi buscada. */
export type Rating = {
  value: number | null;
  fetchedAt: Date;
};

/** As quatro notas; cada uma fica ausente até a primeira busca da fonte. */
export type MovieRatings = {
  letterboxd?: (Rating & { count: number | null }) | undefined;
  imdb?: (Rating & { votes: number | null }) | undefined;
  rottenTomatoes?: (Rating & { url: string | null }) | undefined;
  metacritic?: Rating | undefined;
};

/** Documento movies/{tmdbId}. */
export type Movie = {
  title: string;
  year: number | null;
  directors: Director[]; // a cópia resumida leva só id e nome
  cast: CastMember[]; // os 12 primeiros dos créditos; fica fora da cópia resumida das entradas
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
  directors: PersonRef[]; // até 8; para a tela do diretor achar os filmes dele na lista
};

/** O que cada fonte trouxe num pedido. Fica ausente quando a fonte estava fresca ou falhou. */
export type FetchedSources = {
  tmdb?: TmdbMovie | undefined;
  letterboxd?: LetterboxdRating | undefined;
  omdb?: OmdbRatings | undefined;
};
