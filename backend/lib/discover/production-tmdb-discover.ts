import { readEnv } from '../config/env.js';
import { createTmdbDiscoverClient, type TmdbDiscoverClient } from './tmdb-discover-client.js';

/** Cliente de produção, montado no primeiro pedido e reaproveitado enquanto a função estiver viva. */
let production: TmdbDiscoverClient | undefined;

/**
 * Devolve o cliente do TMDb da busca avançada com o token do ambiente e o fetch global. Provisório:
 * quando `tmdbDiscover` entrar em SourceClients (lib/types/sources.ts e create-source-clients.ts),
 * a rota passa a usar `dependencies.sources.tmdbDiscover` e este arquivo sai.
 *
 * @returns O cliente.
 * @throws {Error} Se as variáveis de ambiente forem inválidas (ver readEnv).
 */
function getProductionTmdbDiscover(): TmdbDiscoverClient {
  production ??= createTmdbDiscoverClient({ token: readEnv().TMDB_TOKEN, fetch });
  return production;
}

export { getProductionTmdbDiscover };
