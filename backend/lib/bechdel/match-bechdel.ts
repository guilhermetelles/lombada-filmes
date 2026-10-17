import type { Movie } from '../types/movie.js';
import type { BechdelClient, BechdelIndexEntry, BechdelPage } from '../types/sources.js';
import type { UsageRecorder } from '../types/usage.js';
import { findCandidates } from './find-candidates.js';

/** O que o casamento usa do filme: título e ano para os candidatos, id do IMDb para confirmar. */
type MovieToMatch = Pick<Movie, 'title' | 'year' | 'ids'>;

/**
 * Casa um filme com o bechdeltest.com: procura os candidatos no índice e lê a página de cada um,
 * na ordem, até achar a que traz o mesmo id do IMDb do filme. Um candidato que não confirma nunca é
 * aceito, então filme sem id do IMDb não casa.
 *
 * @param movie - Título, ano e ids do filme.
 * @param index - Índice do site, já baixado.
 * @param client - Cliente do site, para as páginas dos candidatos.
 * @param usage - Medidor de consumo (cada página conta como um pedido ao `bechdel`).
 * @returns A página confirmada, ou null se o filme não estiver no site.
 * @throws {SourceUnavailableError} Se a página de um candidato falhar; aí não dá para dizer que o filme não está no site.
 */
async function matchBechdel(
  movie: MovieToMatch,
  index: BechdelIndexEntry[],
  client: BechdelClient,
  usage: UsageRecorder,
): Promise<BechdelPage | null> {
  const imdbId = movie.ids.imdb;
  if (imdbId === null) return null;

  for (const candidate of findCandidates(index, movie)) {
    const page = await usage.track('bechdel', () => client.getMoviePage(candidate.siteId));
    if (page.imdbId === imdbId) return page;
  }
  return null;
}

export { matchBechdel };
