import { randomInt } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { DAY_MS } from '../time/durations.js';
import type { Invite } from '../types/list.js';
import { inviteDocument } from './list-repository.js';

/** Sem 0/O e 1/I/L, para não confundir quem digita. */
export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Tamanho do código; o app mostra como "7Q4-KMX". */
export const INVITE_CODE_LENGTH = 6;

/** Validade de um código de convite: 7 dias. */
export const INVITE_LIFETIME_MS = 7 * DAY_MS;

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
 * Normaliza um código digitado: maiúsculas, sem hífen, espaço ou outro separador.
 *
 * @param typed - Código como a pessoa digitou ("7q4-kmx").
 * @returns O código como fica no banco ("7Q4KMX").
 */
export function normalizeInviteCode(typed: string): string {
  return typed.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Formata um código para mostrar, com hífen no meio.
 *
 * @param code - Código como fica no banco ("7Q4KMX").
 * @returns "7Q4-KMX".
 */
export function formatInviteCode(code: string): string {
  return `${code.slice(0, INVITE_CODE_LENGTH / 2)}-${code.slice(INVITE_CODE_LENGTH / 2)}`;
}

/**
 * Monta um convite novo, válido por 7 dias e ainda sem uso.
 *
 * @param listId - Lista do convite.
 * @param createdBy - Quem gerou o código.
 * @param now - Momento da criação.
 * @returns O documento invites/{code}.
 */
export function newInvite(listId: string, createdBy: string, now: Date): Invite {
  return { listId, createdBy, expiresAt: new Date(now.getTime() + INVITE_LIFETIME_MS), usedBy: [] };
}

/**
 * Sorteia um código que ainda não existe, lendo dentro da transação (as leituras de uma transação
 * têm de vir antes das gravações, então chame antes de gravar).
 *
 * @param transaction - Transação em andamento.
 * @param db - Firestore.
 * @returns Código livre.
 * @throws {Error} Se todas as tentativas colidirem.
 */
export async function reserveInviteCode(transaction: Transaction, db: Firestore): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateInviteCode();
    const existing = await transaction.get(inviteDocument(db, code));
    if (!existing.exists) return code;
  }
  throw new Error(`nenhum código de convite livre em ${MAX_CODE_ATTEMPTS} tentativas`);
}
