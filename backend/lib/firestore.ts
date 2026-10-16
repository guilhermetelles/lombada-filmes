import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

// Nos testes, `firebase emulators:exec` define FIRESTORE_EMULATOR_HOST, FIREBASE_AUTH_EMULATOR_HOST
// e GCLOUD_PROJECT (demo-lombada); o Admin SDK fala com os emuladores sem credencial.
// Fora deles, a conta de serviço do lombada-db vem de FIREBASE_SERVICE_ACCOUNT (JSON em uma linha).
function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    return initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-lombada' });
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT não definida');
  return initializeApp({ credential: cert(JSON.parse(raw)) });
}

export function db(): Firestore {
  return getFirestore(app());
}

export function auth(): Auth {
  return getAuth(app());
}
