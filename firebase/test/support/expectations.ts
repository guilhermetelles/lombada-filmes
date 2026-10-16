import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

/**
 * Confere que as regras permitem a operação.
 *
 * @param operation - Operação do Firestore em andamento.
 * @throws {Error} Se as regras negarem.
 */
export async function allows(operation: Promise<unknown>): Promise<void> {
  await assertSucceeds(operation);
}

/**
 * Confere que as regras negam a operação.
 *
 * @param operation - Operação do Firestore em andamento.
 * @throws {Error} Se as regras permitirem.
 */
export async function denies(operation: Promise<unknown>): Promise<void> {
  await assertFails(operation);
}
