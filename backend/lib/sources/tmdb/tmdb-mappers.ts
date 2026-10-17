import type { TmdbCastCredit, TmdbMovieResponse, TmdbSearchResponse } from '../../schemas/sources/tmdb.js';
import type { CastMember, PersonRef } from '../../types/person.js';
import type { TmdbMovie, TmdbSearchResult } from '../../types/sources.js';

/** Tamanho do trecho de sinopse nos resultados de busca. */
const OVERVIEW_EXCERPT_LENGTH = 200;

/** Quantas pessoas do elenco guardar por filme, na ordem dos créditos. */
const CAST_LIMIT = 12;

/**
 * Converte a resposta de detalhes do TMDb no filme do app. O TMDb deixa a tradução em inglês vazia
 * quando o original já é em inglês; daí o original_title como reserva para o título.
 *
 * @param response - Resposta validada de /movie/{id}.
 * @returns O filme com título em inglês e gêneros e sinopse em português.
 */
export function toTmdbMovie(response: TmdbMovieResponse): TmdbMovie {
  const english = findEnglishTranslation(response);
  return {
    // O TMDb deixa a tradução em inglês vazia quando o original já é em inglês; daí o
    // original_title como reserva.
    title: english?.title ?? response.original_title ?? response.title ?? `TMDb ${response.id}`,
    year: response.release_date,
    directors: findDirectors(response),
    cast: toCast(response.credits?.cast ?? []),
    runtime: response.runtime && response.runtime > 0 ? response.runtime : null,
    genres: response.genres.map((genre) => genre.name),
    synopsis: { pt: response.overview, en: english?.overview ?? null },
    posterPath: response.poster_path,
    imdbId: response.external_ids?.imdb_id ?? null,
  };
}

/**
 * Converte a resposta da busca do TMDb nos resultados do app.
 *
 * @param response - Resposta validada de /search/movie.
 * @returns Um resumo por resultado, com a sinopse cortada em trecho.
 */
export function toTmdbSearchResults(response: TmdbSearchResponse): TmdbSearchResult[] {
  return response.results.map((result) => ({
    tmdbId: result.id,
    title: result.title ?? result.original_title ?? `TMDb ${result.id}`,
    originalTitle: result.original_title,
    year: result.release_date,
    posterPath: result.poster_path,
    overview: excerpt(result.overview, OVERVIEW_EXCERPT_LENGTH),
  }));
}

/**
 * Acha a tradução em inglês, preferindo a dos EUA.
 *
 * @param response - Resposta de detalhes do TMDb.
 * @returns Título e sinopse em inglês, ou undefined se não houver tradução em inglês.
 */
function findEnglishTranslation(response: TmdbMovieResponse) {
  const translations = response.translations?.translations ?? [];
  const english = translations.filter((translation) => translation.iso_639_1 === 'en');
  return (english.find((translation) => translation.iso_3166_1 === 'US') ?? english[0])?.data;
}

/**
 * Lista quem dirigiu o filme, a partir da equipe técnica.
 *
 * @param response - Resposta de detalhes do TMDb.
 * @returns Id e nome de quem tem o cargo Director, na ordem do TMDb e sem repetição.
 */
function findDirectors(response: TmdbMovieResponse): PersonRef[] {
  const crew = response.credits?.crew ?? [];
  const directors = crew.filter((person) => person.job === 'Director');
  return uniqueBy(directors, (person) => person.id).map(({ id, name }) => ({ id, name }));
}

/**
 * Corta um texto longo, terminando com reticências.
 *
 * @param text - Texto original.
 * @param maxLength - Tamanho máximo, contando as reticências.
 * @returns O texto, cortado se passar do limite.
 */
function excerpt(text: string | null, maxLength: number): string | null {
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * Converte o elenco dos créditos do TMDb: os 12 primeiros na ordem dos créditos, sem repetir pessoa
 * (quem faz dois papéis aparece uma vez, com o primeiro).
 *
 * @param credits - Elenco dos créditos do filme.
 * @returns O elenco no formato de movies/{tmdbId}.cast.
 */
export function toCast(credits: TmdbCastCredit[]): CastMember[] {
  const ordered = [...credits].sort((a, b) => a.order - b.order);
  return uniqueBy(ordered, (credit) => credit.id)
    .slice(0, CAST_LIMIT)
    .map((credit) => ({
      id: credit.id,
      name: credit.name,
      character: credit.character,
      profilePath: credit.profile_path,
    }));
}

/**
 * Tira itens repetidos, mantendo a primeira ocorrência.
 *
 * @param items - Itens na ordem original.
 * @param keyOf - Chave que identifica um item.
 * @returns Os itens sem repetição de chave.
 */
function uniqueBy<T, Key>(items: T[], keyOf: (item: T) => Key): T[] {
  const seen = new Set<Key>();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
