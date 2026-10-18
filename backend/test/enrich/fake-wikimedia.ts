import { readFileSync } from 'node:fs';
import type { Fetch } from '../../lib/types/sources.js';

/** Fontes da Wikimedia que o fetch falso atende. */
type WikimediaSource = 'wikidata' | 'wikipedia';

/** O fetch falso da Wikimedia e o que ele registra. */
export type FakeWikimedia = {
  fetch: Fetch;
  /** Endereços pedidos ao Wikidata e à Wikipedia, na ordem. */
  requests: URL[];
  /** Cabeçalhos de cada pedido, na ordem. */
  headers: Headers[];
  /** Pedidos por fonte. */
  calls: Record<WikimediaSource, number>;
  /** Fontes que respondem 503, para simular uma fonte fora do ar. */
  failing: Set<WikimediaSource>;
};

/**
 * Cria um fetch que responde aos pedidos do Wikidata e da Wikipedia com as gravações de
 * test/fixtures/ (npm run record:fixtures -- wikidata wikipedia) e repassa os outros hosts.
 * A consulta de filmes (P4947) recebe wikidata-movies.json; a de pessoas (P4985), wikidata-people.json.
 *
 * @param fallback - fetch para os outros hosts (por exemplo, fakeSources().fetch).
 * @returns O fetch, os pedidos recebidos, os contadores e o conjunto de fontes fora do ar.
 * @throws {Error} Ao receber pedido para outro host sem `fallback` (erro do teste).
 */
export function fakeWikimedia(fallback?: Fetch): FakeWikimedia {
  const requests: URL[] = [];
  const headers: Headers[] = [];
  const calls: Record<WikimediaSource, number> = { wikidata: 0, wikipedia: 0 };
  const failing = new Set<WikimediaSource>();

  const fetch: Fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const source: WikimediaSource | null =
      url.hostname === 'query.wikidata.org' ? 'wikidata' : url.hostname === 'en.wikipedia.org' ? 'wikipedia' : null;
    if (!source) {
      if (!fallback) throw new Error(`fetch inesperado em teste: ${url.hostname}`);
      return fallback(input, init);
    }

    requests.push(url);
    headers.push(new Headers(init?.headers));
    calls[source]++;
    if (failing.has(source)) return new Response('fora do ar', { status: 503 });
    if (source === 'wikipedia') return fixture('wikipedia-categories.json');
    const query = url.searchParams.get('query') ?? '';
    return fixture(query.includes('P4985') ? 'wikidata-people.json' : 'wikidata-movies.json');
  };
  return { fetch, requests, headers, calls, failing };
}

/**
 * Lê uma gravação de test/fixtures/ como resposta JSON.
 *
 * @param name - Nome do arquivo.
 * @returns Resposta 200 com o conteúdo do arquivo.
 */
function fixture(name: string): Response {
  const body = readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');
  return new Response(body, { headers: { 'content-type': 'application/json' } });
}
