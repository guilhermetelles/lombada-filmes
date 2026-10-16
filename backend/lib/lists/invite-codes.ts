import { randomInt } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { inviteDocument } from './list-repository.js';

/** Sem 0/O e 1/I/L, para não confundir quem digita. */
export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 6;
export const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/** Com 31⁶ (quase 900 milhões) códigos possíveis, cinco colisões seguidas indicam outro problema. */
const MAX_CODE_ATTEMPTS = 5;

/**
 * Sorteia um código de convite.
 *
 * @param pickIndex - Sorteio de uma posição do alfabeto (troca nos testes); usa crypto.randomInt.
 * @returns Código de 6 caracteres do alfabeto de convite.
 */
export function generateInviteCode(pickIndex: (size: number) => number = randomInt): string {
  return Array.from({ length: INVITE_CODE_LENGTH }, () => INVITE_ALPHABET[pickIndex(INVITE_ALPHABET.length)]).join('');
}

/**
 * Data em que um convite criado agora deixa de valer.
 *
 * @param now - Momento da criação.
 * @returns now + 7 dias.
 */
export function inviteExpiration(now: Date): Date {
  return new Date(now.getTime() + INVITE_LIFETIME_MS);
}

/**
 * Sorteia um código que ainda não existe, lendo dentro da transação (as leituras de uma transação
 * têm de vir antes das gravações, então chame antes de gravar).
 *
 * @param transaction - Transação em andamento.
 * @param db - Firestore.
 * @param pickIndex - Sorteio de posição do alfabeto (troca nos testes).
 * @returns Código livre.
 * @throws {Error} Se todas as tentativas colidirem.
 */
export async function reserveInviteCode(
  transaction: Transaction,
  db: Firestore,
  pickIndex?: (size: number) => number,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateInviteCode(pickIndex);
    const existing = await transaction.get(inviteDocument(db, code));
    if (!existing.exists) return code;
  }
  throw new Error(`nenhum código de convite livre em ${MAX_CODE_ATTEMPTS} tentativas`);
}
