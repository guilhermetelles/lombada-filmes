import type { Firestore } from 'firebase-admin/firestore';
import { NotifyStateSchema } from '../schemas/notify.js';
import { brazilDay } from '../time/brazil-day.js';
import { DEFAULT_NOTIFY_PREFS } from './default-notify-prefs.js';
import { lacksNotifyPrefs, notifyStateDocument, rawNotifyStateDocument } from './notify-repository.js';

/** Aviso liberado: se vai agrupado (com a tag que substitui o anterior). */
export type ActivityPushClaim = { grouped: boolean };

/**
 * Libera um aviso de atividade para a pessoa se ela não desligou os avisos de atividade. Não há
 * intervalo mínimo nem máximo diário: cada alteração avisa. Ao liberar, grava `lastActivityPushAt`,
 * `pushesDay` e `pushesCount` (só para consulta) sem tocar nas preferências; se o documento ainda não
 * tem `prefs`, grava o padrão junto, para a pessoa entrar nas consultas das rotinas notify-*.
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
    const raw = await transaction.get(rawNotifyStateDocument(db, uid));
    const state = raw.exists ? NotifyStateSchema.parse(raw.data()) : undefined;
    const prefs = state?.prefs ?? DEFAULT_NOTIFY_PREFS;
    if (!prefs.activity) return null;

    const day = brazilDay(now);
    const count = state?.pushesDay === day ? (state.pushesCount ?? 0) : 0;
    const missingPrefs = lacksNotifyPrefs(raw) ? { prefs: DEFAULT_NOTIFY_PREFS } : {};
    transaction.set(
      ref,
      { ...missingPrefs, lastActivityPushAt: now, pushesDay: day, pushesCount: count + 1 },
      { merge: true },
    );
    return { grouped: prefs.activityGrouped };
  });
}

export { claimActivityPush };
