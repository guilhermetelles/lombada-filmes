/**
 * Fontes externas de dados de filmes e o que cada uma devolve, já no formato do app.
 * Quando a fonte não tem o filme, as notas vêm null: é uma resposta válida, que também vale 7 dias.
 */

import type { CastMember, Person, PersonRef } from './person.js';

/** Fontes externas, também usadas como chave do consumo em usage/{dia}. */
export type SourceName = 'tmdb' | 'omdb' | 'letterboxd';

/** Assinatura do fetch, injetado nos clientes (o global em produção, um falso nos testes). */
export type Fetch = typeof globalThis.fetch;

/** Sinopse em português e em inglês; null onde o TMDb não tem. */
export type Synopsis = { pt: string | null; en: string | null };

/** Filme como o TMDb descreve, já no formato do app. */
export type TmdbMovie = {
  title: string; // em inglês, como no Letterboxd e na lista original
  year: number | null;
  directors: PersonRef[];
  cast: CastMember[]; // os 12 primeiros dos créditos
  runtime: number | null; // minutos
  genres: string[]; // em português
  synopsis: Synopsis;
  posterPath: string | null;
  imdbId: string | null;
};

/** Um resultado da busca do TMDb, resumido para a lista de busca. */
export type TmdbSearchResult = {
  tmdbId: number;
  title: string; // em português quando o TMDb tem tradução
  originalTitle: string | null;
  year: number | null;
  posterPath: string | null;
  overview: string | null; // trecho de até 200 caracteres
};

/** Pessoa como o TMDb descreve, já no formato de people/{id} (sem a data da busca). */
export type TmdbPerson = Omit<Person, 'fetchedAt'>;

/** As três notas que a OMDb traz juntas. */
export type OmdbRatings = {
  imdb: { value: number | null; votes: number | null };
  rottenTomatoes: { value: number | null; url: string | null };
  metacritic: { value: number | null };
};

/** Nota do Letterboxd e o endereço da página do filme. */
export type LetterboxdRating = {
  value: number | null; // média de 0,5 a 5; null quando o filme ainda tem poucas notas
  count: number | null;
  url: string | null; // página do filme; null quando o Letterboxd não tem o filme
};

/** Cliente do TMDb: detalhes de filme, busca, detalhes de pessoa e elenco. */
export type TmdbClient = {
  getMovie(tmdbId: number): Promise<TmdbMovie>;
  search(query: string): Promise<TmdbSearchResult[]>;
  getPerson(personId: number): Promise<TmdbPerson>;
  getCast(tmdbId: number): Promise<CastMember[]>;
};

/** Cliente da OMDb: notas por id do IMDb. */
export type OmdbClient = {
  getRatings(imdbId: string): Promise<OmdbRatings>;
};

/** Cliente do Letterboxd: nota por id do TMDb. */
export type LetterboxdClient = {
  getRating(tmdbId: number): Promise<LetterboxdRating>;
};

/** Os clientes das três fontes, como as rotas recebem. */
export type SourceClients = {
  tmdb: TmdbClient;
  omdb: OmdbClient;
  letterboxd: LetterboxdClient;
};
