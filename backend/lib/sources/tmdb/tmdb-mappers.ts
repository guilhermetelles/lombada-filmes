import type { TmdbMovieResponse, TmdbSearchResponse } from '../../schemas/sources/tmdb.js';
import type { TmdbMovie, TmdbSearchResult } from '../../types/sources.js';

const OVERVIEW_EXCERPT_LENGTH = 200;

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
 * @returns Nomes de quem tem o cargo Director.
 */
function findDirectors(response: TmdbMovieResponse): string[] {
  const crew = response.credits?.crew ?? [];
  return crew.filter((person) => person.job === 'Director').map((person) => person.name);
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
