import type { TmdbPersonResponse } from '../../schemas/sources/tmdb.js';
import type { BiographyLanguage, DirectedMovie } from '../../types/person.js';
import type { TmdbPerson } from '../../types/sources.js';

/** Quantos filmes dirigidos guardar; o app mostra até 8 depois de tirar os que já estão na lista. */
const DIRECTED_LIMIT = 12;

/**
 * Converte a resposta de pessoa do TMDb no formato de people/{id}.
 *
 * @param response - Resposta validada de /person/{id} em en-US, com créditos e traduções.
 * @returns A pessoa, com a biografia em português quando houver e os filmes que dirigiu.
 */
function toTmdbPerson(response: TmdbPersonResponse): TmdbPerson {
  const { biography, bioLang } = pickBiography(response);
  const directed = directedMovies(response);
  return {
    name: response.name,
    birthday: response.birthday,
    deathday: response.deathday,
    placeOfBirth: response.place_of_birth,
    biography,
    bioLang,
    profilePath: response.profile_path,
    imdbId: response.imdb_id,
    directedCount: directed.length,
    directed: directed.slice(0, DIRECTED_LIMIT),
  };
}

/**
 * Escolhe a biografia: português do Brasil, depois qualquer português, depois inglês.
 *
 * @param response - Resposta de pessoa do TMDb.
 * @returns O texto e o idioma dele; os dois null quando não há biografia.
 */
function pickBiography(response: TmdbPersonResponse): { biography: string | null; bioLang: BiographyLanguage | null } {
  const portuguese = (response.translations?.translations ?? []).filter(
    (translation) => translation.iso_639_1 === 'pt',
  );
  const fromBrazil = portuguese.find((translation) => translation.iso_3166_1 === 'BR')?.data.biography;
  const portugueseBiography =
    fromBrazil ?? portuguese.find((translation) => translation.data.biography)?.data.biography;

  if (portugueseBiography) return { biography: portugueseBiography, bioLang: 'pt' };
  if (response.biography) return { biography: response.biography, bioLang: 'en' };
  return { biography: null, bioLang: null };
}

/**
 * Lista os filmes que a pessoa dirigiu, sem repetição, do mais popular para o menos popular.
 *
 * @param response - Resposta de pessoa do TMDb.
 * @returns Todos os filmes dirigidos, com o título em inglês.
 */
function directedMovies(response: TmdbPersonResponse): DirectedMovie[] {
  const directing = (response.movie_credits?.crew ?? []).filter((credit) => credit.job === 'Director');
  const byId = new Map(directing.map((credit) => [credit.id, credit]));
  return [...byId.values()]
    .sort((a, b) => b.popularity - a.popularity)
    .map((credit) => ({
      tmdbId: credit.id,
      title: credit.title ?? credit.original_title ?? `TMDb ${credit.id}`,
      year: credit.release_date,
    }));
}

export { toTmdbPerson };
