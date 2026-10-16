import { readFileSync } from 'node:fs';
import type { Fetch, SourceName } from '../../lib/types/sources.js';

/** Fonte de cada host que o fetch falso atende. */
const SOURCE_BY_HOST: Record<string, SourceName> = {
  'api.themoviedb.org': 'tmdb',
  'www.omdbapi.com': 'omdb',
  'letterboxd.com': 'letterboxd',
};

/** O fetch falso e o que ele registra. */
export type FakeSources = {
  fetch: Fetch;
  /** Pedidos recebidos por fonte. */
  calls: Record<SourceName, number>;
  /** Fontes que respondem 503, para simular uma fonte fora do ar. */
  failing: Set<SourceName>;
};

/**
 * Cria um fetch falso para os clientes das fontes: responde com as gravações de test/fixtures/
 * (npm run record:fixtures) e conta os pedidos.
 *
 * @returns O fetch, os contadores por fonte e o conjunto de fontes fora do ar.
 * @throws {Error} Ao receber pedido para um host que não é de fonte (erro do teste).
 */
export function fakeSources(): FakeSources {
  const calls: Record<SourceName, number> = { tmdb: 0, omdb: 0, letterboxd: 0 };
  const failing = new Set<SourceName>();

  const fetch: Fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const source = SOURCE_BY_HOST[url.hostname];
    if (!source) throw new Error(`fetch inesperado em teste: ${url.hostname}`);

    calls[source]++;
    if (failing.has(source)) return new Response('fora do ar', { status: 503 });
    return recordedResponse(source, url);
  };

  return { fetch, calls, failing };
}

/**
 * Escolhe a gravação que responde a um pedido.
 *
 * @param source - Fonte chamada.
 * @param url - Endereço pedido.
 * @returns A gravação correspondente, ou 404 se não houver.
 */
function recordedResponse(source: SourceName, url: URL): Response {
  if (source === 'tmdb' && url.pathname === '/3/movie/2756') return fixture('tmdb-movie-2756.json', 'application/json');
  if (source === 'tmdb' && url.pathname === '/3/person/2710') {
    return fixture('tmdb-person-2710.json', 'application/json');
  }
  if (source === 'tmdb' && url.pathname === '/3/search/movie') {
    return fixture('tmdb-search-abismo.json', 'application/json');
  }
  if (source === 'omdb' && url.searchParams.get('i') === 'tt0096754') {
    return fixture('omdb-tt0096754.json', 'application/json');
  }
  if (source === 'letterboxd' && url.pathname === '/tmdb/2756/') return fixture('letterboxd-2756.html', 'text/html');
  return new Response('{"status_message":"not found"}', { status: 404 });
}

/**
 * Lê uma gravação de test/fixtures/ como resposta.
 *
 * @param name - Nome do arquivo.
 * @param contentType - Tipo do conteúdo da resposta.
 * @returns Resposta 200 com o conteúdo do arquivo.
 */
function fixture(name: string, contentType: string): Response {
  const body = readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');
  return new Response(body, { headers: { 'content-type': contentType } });
}

/**
 * Cria um fetch que sempre devolve a mesma resposta, para testar formatos e erros de uma fonte.
 *
 * @param body - Corpo; objetos viram JSON.
 * @param init - Status e cabeçalhos.
 * @returns O fetch.
 */
export function respondWith(body: unknown, init?: ResponseInit): Fetch {
  return async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), init);
}
