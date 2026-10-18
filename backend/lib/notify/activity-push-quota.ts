import type { Firestore } from 'firebase-admin/firestore';
import { brazilDay } from '../time/brazil-day.js';
import { DEFAULT_NOTIFY_PREFS } from './default-notify-prefs.js';
import { notifyStateDocument } from './notify-repository.js';

/** Intervalo mínimo entre dois avisos de atividade agrupados para a mesma pessoa: 15 minutos. */
export const ACTIVITY_PUSH_INTERVAL_MS = 15 * 60 * 1000;

/** Máximo de avisos de atividade por pessoa por dia de Brasília. */
export const ACTIVITY_PUSHES_PER_DAY = 6;

/** Aviso liberado: se vai agrupado (com a tag que substitui o anterior). */
export type ActivityPushClaim = { grouped: boolean };

/**
 * Reserva, numa transação em notifyState/{uid}, um aviso de atividade para a pessoa. Recusa se ela
 * desligou os avisos de atividade, se já recebeu 6 no dia de Brasília ou, com o agrupamento
 * ligado, se recebeu um nos últimos 15 minutos. Ao liberar, grava `lastActivityPushAt`,
 * `pushesDay` e `pushesCount` sem tocar nas preferências.
 *
 * @param db - Firestore.
 * @param uid - Quem receberia o aviso.
 * @param now - Momento do envio.
 * @returns O aviso liberado, ou null se não deve sair.
 * @throws {ZodError} Se notifyState/{uid} estiver fora do formato.
 */
async function claimActivityPush(db: Firestore, uid: string, now: Date): Promise<ActivityPushClaim | null> {
  const ref = notifyStateDocument(db, uid);
  return db.runTransaction(async (transaction) => {
    const state = (await transaction.get(ref)).data();
    const prefs = state?.prefs ?? DEFAULT_NOTIFY_PREFS;
    if (!prefs.activity) return null;

    const day = brazilDay(now);
    const count = state?.pushesDay === day ? (state.pushesCount ?? 0) : 0;
    if (count >= ACTIVITY_PUSHES_PER_DAY) return null;

    const last = state?.lastActivityPushAt;
    if (prefs.activityGrouped && last && now.getTime() - last.getTime() < ACTIVITY_PUSH_INTERVAL_MS) return null;

    transaction.set(ref, { lastActivityPushAt: now, pushesDay: day, pushesCount: count + 1 }, { merge: true });
    return { grouped: prefs.activityGrouped };
  });
}

export { claimActivityPush };
