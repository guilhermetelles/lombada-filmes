import type { Firestore } from 'firebase-admin/firestore';
import { brazilDay } from '../time/brazil-day.js';

/** Lotes de eventos por pessoa por dia de Brasília que ainda geram Atividade e aviso. */
export const EVENTS_DAILY_LIMIT = 300;

/**
 * Conta um lote de eventos da pessoa no dia, numa transação, no campo `events` de
 * rateLimits/{uid}_{dia} (o mesmo documento do limite do search/interpret, só do backend). Acima do
 * limite não conta nada.
 *
 * @param db - Firestore.
 * @param uid - Quem mandou o lote.
 * @param now - Momento do pedido, que define o dia.
 * @returns true se o lote está dentro do limite e foi contado; false se o limite do dia já passou.
 */
async function consumeEventsQuota(db: Firestore, uid: string, now: Date): Promise<boolean> {
  const day = brazilDay(now);
  const reference = db.doc(`rateLimits/${uid}_${day}`);
  return db.runTransaction(async (transaction) => {
    const stored: unknown = (await transaction.get(reference)).get('events');
    const used = typeof stored === 'number' ? stored : 0;
    if (used >= EVENTS_DAILY_LIMIT) return false;
    transaction.set(reference, { uid, day, events: used + 1, updatedAt: now }, { merge: true });
    return true;
  });
}

export { consumeEventsQuota };
