import { createTmdbDiscoverClient } from '../discover/tmdb-discover-client.js';
import type { Fetch, SourceClients } from '../types/sources.js';
import { createBechdelClient } from './bechdel/bechdel-client.js';
import { createGeminiClient } from './gemini/gemini-client.js';
import { createLetterboxdClient } from './letterboxd/letterboxd-client.js';
import { createOmdbClient } from './omdb/omdb-client.js';
import { createTmdbClient } from './tmdb/tmdb-client.js';
import { createWikidataClient } from './wikidata/wikidata-client.js';
import { createWikipediaClient } from './wikipedia/wikipedia-client.js';

/**
 * Token do TMDb, chave da OMDb e chave do Gemini, que é opcional (Letterboxd, bechdeltest.com,
 * Wikidata e Wikipedia não pedem credencial).
 */
type SourceCredentials = { tmdbToken: string; omdbKey: string; geminiApiKey?: string | undefined };

/**
 * Monta os clientes das fontes com as mesmas credenciais e o mesmo fetch.
 *
 * @param credentials - Token do TMDb, chave da OMDb e, se houver, chave do Gemini.
 * @param fetch - fetch injetado (o global em produção, um falso nos testes).
 * @returns Clientes do TMDb, da OMDb, do Letterboxd, do bechdeltest.com, do Wikidata, da Wikipedia e do Gemini.
 */
function createSourceClients({ tmdbToken, omdbKey, geminiApiKey }: SourceCredentials, fetch: Fetch): SourceClients {
  return {
    tmdb: createTmdbClient({ token: tmdbToken, fetch }),
    tmdbDiscover: createTmdbDiscoverClient({ token: tmdbToken, fetch }),
    omdb: createOmdbClient({ apiKey: omdbKey, fetch }),
    letterboxd: createLetterboxdClient({ fetch }),
    bechdel: createBechdelClient({ fetch }),
    wikidata: createWikidataClient({ fetch }),
    wikipedia: createWikipediaClient({ fetch }),
    gemini: createGeminiClient({ apiKey: geminiApiKey, fetch }),
  };
}

export { createSourceClients };
