// Acesso aos emuladores de Auth e Firestore que `npm test` sobe com `firebase emulators:exec`.

/**
 * Lê uma variável que `firebase emulators:exec` define.
 *
 * @param name - Nome da variável.
 * @returns O valor.
 * @throws {Error} Se a variável faltar, ou seja, se o teste não foi rodado com `npm test`.
 */
function requireEmulatorVariable(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} ausente: rode com \`npm test\`, que sobe os emuladores`);
  return value;
}

export const emulatorProject = process.env.GCLOUD_PROJECT ?? 'demo-lombada';
export const firestoreEmulatorHost = requireEmulatorVariable('FIRESTORE_EMULATOR_HOST');
const authEmulatorHost = requireEmulatorVariable('FIREBASE_AUTH_EMULATOR_HOST');

type SignedUpUser = { uid: string; idToken: string };

/**
 * Cria uma conta no emulador de Auth.
 *
 * @param email - E-mail da conta.
 * @returns O uid e um ID token válido para ela.
 * @throws {Error} Se o emulador recusar o cadastro.
 */
export async function signUp(email: string): Promise<SignedUpUser> {
  const url = `http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'senha-de-teste', returnSecureToken: true }),
  });
  if (!response.ok) throw new Error(`signUp falhou: ${response.status} ${await response.text()}`);

  const body = (await response.json()) as { localId: string; idToken: string };
  return { uid: body.localId, idToken: body.idToken };
}

/** Apaga todas as contas e todos os documentos dos emuladores. */
export async function resetEmulators(): Promise<void> {
  const projectPath = `emulator/v1/projects/${emulatorProject}`;
  await fetch(`http://${authEmulatorHost}/${projectPath}/accounts`, { method: 'DELETE' });
  await fetch(`http://${firestoreEmulatorHost}/${projectPath}/databases/(default)/documents`, { method: 'DELETE' });
}
