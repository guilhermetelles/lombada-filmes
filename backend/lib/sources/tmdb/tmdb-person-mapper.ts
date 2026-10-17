import type { TmdbPersonResponse } from '../../schemas/sources/tmdb.js';
import type { ActedMovie, BiographyLanguage, DirectedMovie } from '../../types/person.js';
import type { TmdbPerson } from '../../types/sources.js';

/** Quantos filmes dirigidos guardar; o app mostra até 8 depois de tirar os que já estão na lista. */
const DIRECTED_LIMIT = 12;

/** Quantos filmes atuados guardar; o app cruza com a lista e mostra o resto como "de que participou". */
const ACTED_LIMIT = 20;

/** Papel que é só reaproveitamento de imagens antigas, não atuação no filme. */
const ARCHIVE_FOOTAGE = /\(archive footage\)/i;

/**
 * Converte a resposta de pessoa do TMDb no formato de people/{id}.
 *
 * @param response - Resposta validada de /person/{id} em en-US, com créditos e traduções.
 * @returns A pessoa, com a biografia em português quando houver e os filmes que dirigiu e em que atuou.
 */
function toTmdbPerson(response: TmdbPersonResponse): TmdbPerson {
  const { biography, bioLang } = pickBiography(response);
  const directed = directedMovies(response);
  const acted = actedMovies(response);
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
    actedCount: acted.length,
    acted: acted.slice(0, ACTED_LIMIT),
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

/**
 * Lista os filmes em que a pessoa atuou, sem repetição, do mais votado para o menos votado. Papéis
 * só com imagens de arquivo ficam de fora; "(uncredited)" e participações como si mesma ficam.
 *
 * @param response - Resposta de pessoa do TMDb.
 * @returns Todos os filmes atuados, com o título em inglês e o personagem.
 */
function actedMovies(response: TmdbPersonResponse): ActedMovie[] {
  const acting = (response.movie_credits?.cast ?? []).filter((credit) => !ARCHIVE_FOOTAGE.test(credit.character ?? ''));
  const byId = new Map<number, (typeof acting)[number]>();
  for (const credit of acting) if (!byId.has(credit.id)) byId.set(credit.id, credit);
  return [...byId.values()]
    .sort((a, b) => b.vote_count - a.vote_count)
    .map((credit) => ({
      tmdbId: credit.id,
      title: credit.title ?? credit.original_title ?? `TMDb ${credit.id}`,
      year: credit.release_date,
      character: credit.character,
    }));
}

export { toTmdbPerson };
