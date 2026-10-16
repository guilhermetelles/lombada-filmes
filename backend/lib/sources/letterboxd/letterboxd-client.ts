import { NotFoundError } from '../../errors/app-errors.js';
import type { Fetch, LetterboxdClient, LetterboxdRating } from '../../types/sources.js';
import { fetchFromSource } from '../shared/fetch-json.js';
import { readFilmJsonLd } from './film-json-ld.js';

/** O Letterboxd recusa pedidos sem cara de navegador. */
export const LETTERBOXD_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';

const NOT_ON_LETTERBOXD: LetterboxdRating = { value: null, count: null, url: null };

/**
 * Cria o cliente do Letterboxd. Sem API pública, ele lê a página do filme:
 * letterboxd.com/tmdb/{id}/ redireciona para a página a partir do id do TMDb.
 *
 * @param options - O fetch a usar.
 * @returns Cliente de nota por id do TMDb.
 */
export function createLetterboxdClient({ fetch }: { fetch: Fetch }): LetterboxdClient {
  return {
    /**
     * Busca a nota de um filme. 404 não é falha: o Letterboxd não tem o filme, e a nota vem vazia.
     *
     * @param tmdbId - Id do filme no TMDb.
     * @returns Média, número de notas e endereço da página do filme.
     * @throws {SourceUnavailableError} Se a página falhar, vier sem JSON-LD (bloqueio) ou fora do formato.
     */
    async getRating(tmdbId) {
      const url = `https://letterboxd.com/tmdb/${tmdbId}/`;
      let response: Response;
      try {
        response = await fetchFromSource(fetch, 'letterboxd', url, {
          headers: { 'user-agent': LETTERBOXD_USER_AGENT },
        });
      } catch (error) {
        // 404 não é falha: o Letterboxd não tem esse filme.
        if (error instanceof NotFoundError) return NOT_ON_LETTERBOXD;
        throw error;
      }
      const film = readFilmJsonLd(await response.text());
      const average = film.aggregateRating?.ratingValue;

      return {
        value: average === undefined ? null : roundToHundredths(average),
        count: film.aggregateRating?.ratingCount ?? null,
        url: film.url ?? (response.url || url),
      };
    },
  };
}

/**
 * Arredonda para duas casas, como o Letterboxd mostra.
 *
 * @param value - Número a arredondar.
 * @returns O número com até duas casas decimais.
 */
function roundToHundredths(value: number): number {
  return Math.round(value * 100) / 100;
}
