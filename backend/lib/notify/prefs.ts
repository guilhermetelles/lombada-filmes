import type { Firestore } from 'firebase-admin/firestore';
import type { NotifyPrefs } from '../types/notify.js';
import { DEFAULT_NOTIFY_PREFS } from './default-notify-prefs.js';
import { notifyStateDocument } from './notify-repository.js';

/**
 * Lê as preferências de notificação de notifyState/{uid}.prefs.
 *
 * @param db - Firestore.
 * @param uid - Pessoa.
 * @returns As preferências gravadas, ou o padrão se nunca foram gravadas.
 * @throws {ZodError} Se o documento gravado estiver fora do formato.
 */
export async function readNotifyPrefs(db: Firestore, uid: string): Promise<NotifyPrefs> {
  const state = (await notifyStateDocument(db, uid).get()).data();
  return state?.prefs ?? DEFAULT_NOTIFY_PREFS;
}

/**
 * Grava as preferências de notificação em notifyState/{uid}.prefs, trocando o campo inteiro e
 * mantendo os limites de envio (lastActivityPushAt, pushesDay, pushesCount) como estão.
 *
 * @param db - Firestore.
 * @param uid - Pessoa.
 * @param prefs - Preferências já validadas.
 */
export async function saveNotifyPrefs(db: Firestore, uid: string, prefs: NotifyPrefs): Promise<void> {
  await notifyStateDocument(db, uid).set({ prefs }, { mergeFields: ['prefs'] });
}
