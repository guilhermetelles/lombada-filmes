import type { Awards } from './awards.js';
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

/**
 * Teste de Bechdel segundo o bechdeltest.com. Filme que não está no site fica com `siteId`, `url` e
 * `rating` null, `dubious` false e `disputes` 0.
 */
export type Bechdel = {
  siteId: number | null;
  url: string | null; // página do filme no site
  rating: number | null; // quantos dos 3 critérios o filme passa
  dubious: boolean; // o site marca a avaliação como duvidosa
  disputes: number; // quantas pessoas contestaram a avaliação nos comentários
  fetchedAt: Date; // quando a página do filme foi lida (ou a busca não achou o filme)
};

/** Coleção (saga) do TMDb a que o filme pertence. */
export type MovieCollection = {
  id: number;
  name: string;
};

/** Resumo de um filme recomendado pelo TMDb, para a fileira de parecidos abrir sem ler cada filme. */
export type MovieRecInfo = {
  tmdbId: number;
  title: string; // em pt-BR quando o TMDb tem tradução
  titleEn?: string | undefined; // título original, só quando o idioma original é inglês
  year: number | null;
  posterPath: string | null;
};

/** Onde assistir no Brasil por assinatura, com os serviços da busca anterior para notar o que chegou. */
export type ProvidersBR = {
  flatrate: string[];
  previous: string[];
  fetchedAt: Date;
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
  bechdel?: Bechdel | undefined; // ausente até a primeira busca; fica fora da cópia resumida
  // Campos extras da versão 0.3, buscados pela rotina enrich (frescor de 30 dias por extraFetchedAt).
  titlePt?: string | null | undefined; // título no Brasil (TMDb pt-BR)
  tagline?: string | null | undefined; // slogan em pt-BR
  budget?: number | null | undefined; // US$
  revenue?: number | null | undefined; // bilheteria mundial, US$
  boxOfficeUS?: number | null | undefined; // OMDb BoxOffice, US$
  certBR?: string | null | undefined; // classificação indicativa no Brasil
  streamingFirst?: boolean | null | undefined; // lançado direto em streaming, pelos tipos de lançamento do TMDb
  collection?: MovieCollection | null | undefined;
  keywords?: string[] | undefined; // até 25, em inglês (nomes do TMDb)
  recs?: number[] | undefined; // até 10 ids do TMDb (recomendações do TMDb)
  recsInfo?: MovieRecInfo[] | undefined; // os mesmos ids de recs, com título, ano e pôster
  release?: string | null | undefined; // AAAA-MM-DD, release_date do TMDb (aniversário de estreia)
  providersBR?: ProvidersBR | undefined;
  awards?: Awards | undefined;
  popularity?: number | undefined;
  vote?: number | null | undefined;
  votes?: number | undefined;
  extraFetchedAt?: Date | undefined;
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
