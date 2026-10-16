// Ajudantes para os testes nos emuladores (rodados por `npm test`, via firebase emulators:exec).
const project = process.env.GCLOUD_PROJECT ?? 'demo-lombada';
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
if (!authHost || !firestoreHost) throw new Error('rode com `npm test` (precisa dos emuladores)');

// Cria uma conta no emulador de Auth e devolve o uid e um ID token válido para ela.
export async function signUp(email: string): Promise<{ uid: string; idToken: string }> {
  const res = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'senha-de-teste', returnSecureToken: true }),
  });
  if (!res.ok) throw new Error(`signUp falhou: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { localId: string; idToken: string };
  return { uid: body.localId, idToken: body.idToken };
}

export async function resetEmulators(): Promise<void> {
  await fetch(`http://${authHost}/emulator/v1/projects/${project}/accounts`, { method: 'DELETE' });
  await fetch(`http://${firestoreHost}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: 'DELETE' });
}

export function request(path: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost${path}`, init);
}
