import type { Fetch, SourceClients } from '../types/sources.js';
import { createBechdelClient } from './bechdel/bechdel-client.js';
import { createLetterboxdClient } from './letterboxd/letterboxd-client.js';
import { createOmdbClient } from './omdb/omdb-client.js';
import { createTmdbClient } from './tmdb/tmdb-client.js';

/** Token do TMDb e chave da OMDb (Letterboxd e bechdeltest.com não pedem credencial). */
type SourceCredentials = { tmdbToken: string; omdbKey: string };

/**
 * Monta os clientes das fontes com as mesmas credenciais e o mesmo fetch.
 *
 * @param credentials - Token do TMDb e chave da OMDb.
 * @param fetch - fetch injetado (o global em produção, um falso nos testes).
 * @returns Clientes do TMDb, da OMDb, do Letterboxd e do bechdeltest.com.
 */
function createSourceClients({ tmdbToken, omdbKey }: SourceCredentials, fetch: Fetch): SourceClients {
  return {
    tmdb: createTmdbClient({ token: tmdbToken, fetch }),
    omdb: createOmdbClient({ apiKey: omdbKey, fetch }),
    letterboxd: createLetterboxdClient({ fetch }),
    bechdel: createBechdelClient({ fetch }),
  };
}

export { createSourceClients };
