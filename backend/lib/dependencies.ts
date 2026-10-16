import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readEnv } from './config/env.js';
import { getFirebaseApp } from './config/firebase-app.js';
import { createSourceClients } from './sources/create-source-clients.js';
import type { Dependencies } from './types/dependencies.js';

let production: Dependencies | undefined;

/**
 * Devolve as dependências de produção, montadas no primeiro pedido e reaproveitadas enquanto a
 * função da Vercel estiver viva. É o único ponto que monta tudo, por isso fica na raiz de lib/.
 *
 * @returns Banco, Auth, clientes das fontes e relógio de produção.
 * @throws {Error} Se as variáveis de ambiente forem inválidas (ver readEnv).
 */
export function getProductionDependencies(): Dependencies {
  production ??= createProductionDependencies();
  return production;
}

/**
 * Monta as dependências de produção a partir das variáveis de ambiente.
 *
 * @returns Dependências novas.
 */
function createProductionDependencies(): Dependencies {
  const env = readEnv();
  const app = getFirebaseApp(env);
  return {
    db: getFirestore(app),
    auth: getAuth(app),
    sources: createSourceClients({ tmdbToken: env.TMDB_TOKEN, omdbKey: env.OMDB_KEY }, fetch),
    now: () => new Date(),
    cronSecret: env.CRON_SECRET,
  };
}
