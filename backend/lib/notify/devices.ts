import type { Firestore } from 'firebase-admin/firestore';
import { listsOfMember } from '../lists/list-repository.js';
import type { MessagingClient } from '../types/dependencies.js';
import type { DevicePlatform } from '../types/notify.js';
import { DEFAULT_NOTIFY_PREFS } from './default-notify-prefs.js';
import {
  deviceTokenDocument,
  deviceTokensCollection,
  lacksNotifyPrefs,
  notifyStateDocument,
  rawNotifyStateDocument,
} from './notify-repository.js';
import { sendFcm } from './send-fcm.js';

/** Máximo de aparelhos por pessoa: ao registrar o sexto, o mais antigo é esquecido. */
export const MAX_DEVICES_PER_PERSON = 5;

/**
 * Registra (ou renova) o token do FCM de um aparelho em devices/{uid}/tokens/{sha256}, com
 * `updatedAt` de agora. Se a pessoa passar de 5 aparelhos, apaga os de `updatedAt` mais antigo, na
 * mesma transação. Quem ainda não tem `prefs` em notifyState/{uid} ganha o padrão, gravado junto.
 *
 * @param db - Firestore.
 * @param uid - Dona do aparelho.
 * @param device - Token do FCM e plataforma.
 * @param now - Momento do registro.
 */
export async function registerDevice(
  db: Firestore,
  uid: string,
  { token, platform }: { token: string; platform: DevicePlatform },
  now: Date,
): Promise<void> {
  const ref = deviceTokenDocument(db, uid, token);
  await db.runTransaction(async (transaction) => {
    const others = (await transaction.get(deviceTokensCollection(db, uid))).docs.filter((doc) => doc.id !== ref.id);
    const newestFirst = others.sort((a, b) => b.data().updatedAt.getTime() - a.data().updatedAt.getTime());
    const state = await transaction.get(rawNotifyStateDocument(db, uid));

    transaction.set(ref, { token, platform, updatedAt: now });
    if (lacksNotifyPrefs(state)) {
      transaction.set(notifyStateDocument(db, uid), { prefs: DEFAULT_NOTIFY_PREFS }, { merge: true });
    }
    for (const stale of newestFirst.slice(MAX_DEVICES_PER_PERSON - 1)) transaction.delete(stale.ref);
  });
}

/**
 * Esquece o token do FCM de um aparelho (ao sair da conta). Sem erro se ele não estava registrado.
 *
 * @param db - Firestore.
 * @param uid - Dona do aparelho.
 * @param token - Token do FCM.
 */
export async function unregisterDevice(db: Firestore, uid: string, token: string): Promise<void> {
  await deviceTokenDocument(db, uid, token).delete();
}

/** Texto da notificação de teste. */
const TEST_PUSH = {
  title: 'Notificação de teste',
  body: 'As notificações do Lombada estão chegando neste aparelho.',
} as const;

/**
 * Manda uma notificação de teste para todos os aparelhos da pessoa, no canal `lembrete`, abrindo a
 * Atividade da primeira lista dela (sem lista, o listId vai vazio e o app usa a lista ativa).
 *
 * @param dependencies - Firestore e o cliente do FCM.
 * @param uid - Quem recebe.
 * @returns Quantos aparelhos o FCM aceitou.
 * @throws O erro do FCM ou do Firestore, se o envio inteiro falhar.
 */
export async function sendTestPush(
  dependencies: { db: Firestore; messaging: MessagingClient },
  uid: string,
): Promise<number> {
  const firstList = (await listsOfMember(dependencies.db, uid).limit(1).get()).docs.at(0);
  const { sent } = await sendFcm(dependencies, uid, {
    ...TEST_PUSH,
    listId: firstList?.id ?? '',
    route: { name: 'feed' },
    channelId: 'lembrete',
  });
  return sent;
}
