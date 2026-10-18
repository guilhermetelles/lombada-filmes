import { readFileSync } from 'node:fs';
import type { Fetch } from '../../lib/types/sources.js';

/** Pedidos ao TMDb que o fetch falso da busca avançada atende. */
export type DiscoverEndpoint = 'discover' | 'trending' | 'extras';

/** O fetch falso da busca avançada e o que ele registra. */
export type DiscoverFetch = {
  fetch: Fetch;
  /** URLs pedidas, na ordem. */
  urls: URL[];
  /** Pedidos que respondem 503, para simular o TMDb fora do ar. */
  failing: Set<DiscoverEndpoint>;
};

/**
 * Lê uma gravação de test/fixtures/ como JSON.
 *
 * @param name - Nome do arquivo.
 * @returns O conteúdo.
 */
export function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));
}

/**
 * Cria um fetch falso do TMDb para a busca avançada, com as gravações reais de 2026-10-18:
 * /discover/movie de comédias com tema LGBT+ (discover-comedia-lgbt.json, a mesma página para
 * qualquer consulta), /trending/movie/week (discover-trending-week.json) e os detalhes dos 20
 * filmes da página (discover-extras.json, só com o Brasil em watch/providers).
 *
 * @returns O fetch, as URLs pedidas e os pedidos fora do ar.
 * @throws {Error} Ao receber pedido fora do TMDb (erro do teste).
 */
export function discoverFetch(): DiscoverFetch {
  const urls: URL[] = [];
  const failing = new Set<DiscoverEndpoint>();
  const extras = readFixture('discover-extras.json') as Record<string, unknown>;

  const fetch: Fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.hostname !== 'api.themoviedb.org') throw new Error(`fetch inesperado em teste: ${url.hostname}`);
    urls.push(url);

    const endpoint = endpointOf(url);
    if (endpoint && failing.has(endpoint)) return new Response('fora do ar', { status: 503 });
    if (endpoint === 'discover') return json(readFixture('discover-comedia-lgbt.json'));
    if (endpoint === 'trending') return json(readFixture('discover-trending-week.json'));
    const id = /^\/3\/movie\/(\d+)$/.exec(url.pathname)?.[1];
    if (id && extras[id]) return json(extras[id]);
    return new Response('{"status_message":"not found"}', { status: 404 });
  };

  return { fetch, urls, failing };
}

/**
 * Diz qual pedido da busca avançada é a URL.
 *
 * @param url - Endereço pedido.
 * @returns O pedido, ou undefined se não for um dos três.
 */
function endpointOf(url: URL): DiscoverEndpoint | undefined {
  if (url.pathname === '/3/discover/movie') return 'discover';
  if (url.pathname === '/3/trending/movie/week') return 'trending';
  if (url.pathname.startsWith('/3/movie/')) return 'extras';
  return undefined;
}

/**
 * Resposta 200 com JSON.
 *
 * @param body - Corpo.
 * @returns A resposta.
 */
function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
}
