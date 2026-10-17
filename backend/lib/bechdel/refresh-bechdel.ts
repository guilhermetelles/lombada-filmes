import type { Bechdel, Movie } from '../types/movie.js';
import type { BechdelClient, BechdelPage } from '../types/sources.js';
import type { UsageRecorder } from '../types/usage.js';
import type { BechdelIndexLoader } from './bechdel-index-loader.js';
import { matchBechdel } from './match-bechdel.js';

/** O que uma atualização fez: releu a página de um casado, casou agora ou não achou no site. */
export type BechdelOutcome = 'refreshed' | 'matched' | 'notFound';

/** Resultado de uma atualização: o que foi feito e o valor a gravar. */
export type BechdelRefresh = { outcome: BechdelOutcome; bechdel: Bechdel };

/** Cliente do site, medidor de consumo, momento da busca e o índice compartilhado. */
type RefreshContext = {
  client: BechdelClient;
  usage: UsageRecorder;
  now: Date;
  loadIndex: BechdelIndexLoader;
};

/**
 * Atualiza o Teste de Bechdel de um filme. Filme já casado só tem a página relida; os outros são
 * procurados no índice e confirmados pelo id do IMDb. Usado ao abrir o filme e pela rotina diária.
 *
 * @param movie - Documento guardado (o casamento precisa de título, ano e id do IMDb).
 * @param context - Cliente do site, medidor de consumo, momento da busca e o carregador do índice.
 * @returns O que foi feito e o valor novo de `bechdel`.
 * @throws {NotFoundError} Se o site não tiver mais o id de um filme casado.
 * @throws {SourceUnavailableError} Se o site falhar ou mudar de formato; o valor guardado continua valendo.
 */
export async function refreshBechdel(
  movie: Movie,
  { client, usage, now, loadIndex }: RefreshContext,
): Promise<BechdelRefresh> {
  const siteId = movie.bechdel?.siteId;
  if (siteId !== undefined && siteId !== null) {
    const page = await usage.track('bechdel', () => client.getMoviePage(siteId));
    return { outcome: 'refreshed', bechdel: fromPage(page, now) };
  }

  const page = await matchBechdel(movie, await loadIndex(), client, usage);
  if (!page) return { outcome: 'notFound', bechdel: notOnSite(now) };
  return { outcome: 'matched', bechdel: fromPage(page, now) };
}

/**
 * Monta o valor de `bechdel` a partir da página do filme.
 *
 * @param page - Página lida.
 * @param now - Momento da leitura.
 * @returns O Teste de Bechdel do filme.
 */
function fromPage({ siteId, url, rating, dubious, disputes }: BechdelPage, now: Date): Bechdel {
  return { siteId, url, rating, dubious, disputes, fetchedAt: now };
}

/**
 * Valor de `bechdel` para filme que não está no site.
 *
 * @param now - Momento da busca.
 * @returns `siteId`, `url` e `rating` null, sem duvidosa nem contestações.
 */
function notOnSite(now: Date): Bechdel {
  return { siteId: null, url: null, rating: null, dubious: false, disputes: 0, fetchedAt: now };
}
