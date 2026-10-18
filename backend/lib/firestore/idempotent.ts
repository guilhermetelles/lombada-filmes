import type { DocumentReference, WithFieldValue } from 'firebase-admin/firestore';

/** Código gRPC que o Firestore devolve quando create() acha o documento já existente. */
const ALREADY_EXISTS = 6;

/**
 * Cria o documento só se ele ainda não existir, sem ler antes (create() falha se já existir). É a
 * base da idempotência das rotinas: rodar duas vezes com o mesmo id não duplica nada.
 *
 * @param ref - Documento a criar, com id determinístico (ex.: quiz-winner-2026-10).
 * @param data - Conteúdo do documento.
 * @returns true se criou; false se o documento já existia.
 * @throws O erro do Firestore, se a gravação falhar por outro motivo.
 */
async function createIfAbsent<T>(ref: DocumentReference<T>, data: WithFieldValue<T>): Promise<boolean> {
  try {
    await ref.create(data);
    return true;
  } catch (error) {
    if (isAlreadyExists(error)) return false;
    throw error;
  }
}

/**
 * Diz se o erro do Firestore é "documento já existe".
 *
 * @param error - Erro lançado por create().
 * @returns true para ALREADY_EXISTS.
 */
function isAlreadyExists(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === ALREADY_EXISTS;
}

export { createIfAbsent };
