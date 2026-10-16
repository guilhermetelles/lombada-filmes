import { type App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { ServiceAccountSchema } from '../schemas/env.js';
import type { Env, ServiceAccount } from '../types/env.js';

type FirebaseEnv = Pick<Env, 'FIREBASE_SERVICE_ACCOUNT' | 'FIRESTORE_EMULATOR_HOST' | 'GCLOUD_PROJECT'>;

/**
 * Devolve o app do Admin SDK, criado uma vez por processo. Nos emuladores não precisa de
 * credencial; fora deles usa a conta de serviço do lombada-db.
 *
 * @param env - Variáveis de ambiente que dizem onde conectar.
 * @returns O app já existente ou um novo.
 * @throws {Error} Se FIREBASE_SERVICE_ACCOUNT não for um JSON de conta de serviço válido.
 */
export function getFirebaseApp(env: FirebaseEnv): App {
  const existing = getApps()[0];
  if (existing) return existing;

  if (env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId: env.GCLOUD_PROJECT });
  }

  const account = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT ?? '');
  return initializeApp({
    credential: cert({
      projectId: account.project_id,
      clientEmail: account.client_email,
      privateKey: account.private_key,
    }),
  });
}

/**
 * Lê a conta de serviço do texto JSON da variável de ambiente. As mensagens de erro não repetem
 * o conteúdo: o erro do JSON.parse cita um trecho da entrada, o que vazaria a chave privada no log.
 *
 * @param raw - Conteúdo de FIREBASE_SERVICE_ACCOUNT.
 * @returns Os campos que o Admin SDK usa.
 * @throws {Error} Se o texto não for JSON ou faltar project_id, client_email ou private_key.
 */
function parseServiceAccount(raw: string): ServiceAccount {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT não é um JSON válido');
  }

  const result = ServiceAccountSchema.safeParse(json);
  if (!result.success) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT sem project_id, client_email ou private_key');
  }
  return result.data;
}
