import type { Firestore } from 'firebase-admin/firestore';
import { RateLimitedError } from '../errors/app-errors.js';
import { RateLimitDocSchema } from '../schemas/rate-limit.js';
import { brazilDay } from '../time/brazil-day.js';

/** Interpretações de texto livre por pessoa por dia (no fuso de Brasília). */
export const INTERPRET_DAILY_LIMIT = 30;

/**
 * Conta uma interpretação de texto livre da pessoa no dia, numa transação, antes de chamar o
 * Gemini. O contador fica em rateLimits/{uid}_{dia} (dia de Brasília), que só o backend lê e grava.
 * Acima do limite não conta nada e recusa.
 *
 * @param db - Firestore.
 * @param uid - Quem pede.
 * @param now - Momento do pedido, que define o dia.
 * @returns Quantas interpretações a pessoa já fez no dia, contando esta.
 * @throws {RateLimitedError} Se a pessoa já fez INTERPRET_DAILY_LIMIT interpretações no dia.
 */
async function consumeInterpretQuota(db: Firestore, uid: string, now: Date): Promise<number> {
  const day = brazilDay(now);
  const reference = db.doc(`rateLimits/${uid}_${day}`);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const used = snapshot.exists ? RateLimitDocSchema.parse(snapshot.data()).interpret : 0;
    if (used >= INTERPRET_DAILY_LIMIT) {
      throw new RateLimitedError(`limite de ${INTERPRET_DAILY_LIMIT} interpretações por dia atingido; tente amanhã`);
    }
    transaction.set(reference, { uid, day, interpret: used + 1, updatedAt: now }, { merge: true });
    return used + 1;
  });
}

export { consumeInterpretQuota };
