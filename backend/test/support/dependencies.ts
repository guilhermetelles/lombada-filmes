import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseApp } from '../../lib/config/firebase-app.js';
import { createSourceClients } from '../../lib/sources/create-source-clients.js';
import type { Dependencies, MessagingClient } from '../../lib/types/dependencies.js';
import type { Fetch, GeminiClient } from '../../lib/types/sources.js';
import { emulatorProject, firestoreEmulatorHost } from './emulators.js';
import { createFakeMessaging } from './fake-messaging.js';

/** Credenciais falsas: o fetch falso não confere. */
const TEST_CREDENTIALS = { tmdbToken: 'token-de-teste', omdbKey: 'chave-de-teste', geminiApiKey: 'chave-de-teste' };

/** Segredo do cron nos testes. */
export const TEST_CRON_SECRET = 'segredo-do-cron-de-teste';

/** Trocas opcionais nas dependências de teste. */
type TestOverrides = {
  /** Gemini falso (createFakeGemini); sem ele, vale o cliente montado com o fetch falso. */
  gemini?: GeminiClient;
  /** FCM falso (createFakeMessaging); sem ele, um FCM falso que aceita todo token. */
  messaging?: MessagingClient;
};

/**
 * Monta dependências reais (Admin SDK nos emuladores e os clientes de verdade), trocando só o fetch,
 * o relógio, o FCM e, se o teste pedir, o Gemini.
 *
 * @param fetch - fetch falso das fontes (fakeSources ou respondWith).
 * @param now - Relógio controlado pelo teste.
 * @param overrides - Gemini e FCM falsos do teste.
 * @returns Dependências prontas para passar a uma rota.
 */
function createTestDependencies(
  fetch: Fetch,
  now: () => Date = () => new Date(),
  overrides: TestOverrides = {},
): Dependencies {
  const app = getFirebaseApp({ FIRESTORE_EMULATOR_HOST: firestoreEmulatorHost, GCLOUD_PROJECT: emulatorProject });
  const sources = createSourceClients(TEST_CREDENTIALS, fetch);
  return {
    db: getFirestore(app),
    auth: getAuth(app),
    sources: overrides.gemini ? { ...sources, gemini: overrides.gemini } : sources,
    messaging: overrides.messaging ?? createFakeMessaging().messaging,
    now,
    cronSecret: TEST_CRON_SECRET,
  };
}

export { createTestDependencies };
