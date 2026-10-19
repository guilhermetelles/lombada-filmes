import type { Firestore } from 'firebase-admin/firestore';
import type { MulticastMessage } from 'firebase-admin/messaging';
import { writeInBatches } from '../firestore/write-in-batches.js';
import { logger } from '../logging/logger.js';
import type { MessagingClient } from '../types/dependencies.js';
import type { PushMessage, PushResult } from '../types/notify.js';
import { deviceTokensCollection } from './notify-repository.js';

/**
 * Erros do FCM que dizem que o token não serve mais: o aparelho é esquecido. `invalid-argument` fica
 * de fora: ele vem também de mensagem mal montada (corpo longo demais, por exemplo), e apagar o token
 * por isso deixaria o aparelho sem avisos.
 */
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

/** Tamanho máximo do texto da notificação; acima disso, cortado com reticências. */
export const PUSH_BODY_LIMIT = 180;

/** Máximo de tokens num envio do FCM. */
const MULTICAST_LIMIT = 500;

/**
 * Manda uma notificação para todos os aparelhos de uma pessoa (devices/{uid}/tokens), no formato
 * do contrato §4, e apaga os tokens que o FCM diz que não valem mais. Não confere preferências nem
 * limites: isso é de quem chama.
 *
 * @param dependencies - Firestore e o cliente do FCM.
 * @param uid - Quem recebe.
 * @param push - Título, texto, lista, rota, canal e, se houver, item da Atividade e tag.
 * @returns Quantos aparelhos o FCM aceitou e quantos tokens foram apagados.
 * @throws O erro do FCM ou do Firestore, se o envio inteiro falhar.
 */
async function sendFcm(
  { db, messaging }: { db: Firestore; messaging: MessagingClient },
  uid: string,
  push: PushMessage,
): Promise<PushResult> {
  const devices = await deviceTokensCollection(db, uid).get();
  if (devices.empty) return { sent: 0, removed: 0 };

  const tokens = devices.docs.map((doc) => ({ ref: doc.ref, token: doc.data().token }));
  let sent = 0;
  const invalid: typeof tokens = [];

  for (let start = 0; start < tokens.length; start += MULTICAST_LIMIT) {
    const chunk = tokens.slice(start, start + MULTICAST_LIMIT);
    const response = await messaging.sendEachForMulticast(
      buildMessage(
        push,
        chunk.map(({ token }) => token),
      ),
    );
    sent += response.successCount;
    response.responses.forEach((result, index) => {
      const device = chunk[index];
      if (!result.success && device && INVALID_TOKEN_CODES.has(result.error?.code ?? '')) invalid.push(device);
    });
  }

  if (invalid.length > 0) {
    await writeInBatches(db, invalid, (batch, { ref }) => batch.delete(ref));
    logger.info('tokens do FCM inválidos apagados', { uid, removed: invalid.length });
  }
  return { sent, removed: invalid.length };
}

/**
 * Monta a mensagem do FCM: notificação visível, extras para o app abrir a tela certa, canal e tag.
 *
 * @param push - Notificação a mandar.
 * @param tokens - Aparelhos de destino (até 500).
 * @returns A mensagem para sendEachForMulticast.
 */
function buildMessage(push: PushMessage, tokens: string[]): MulticastMessage {
  // Os extras do FCM só aceitam texto: a rota vai em JSON, e o feedId só quando existe.
  const data: Record<string, string> = { listId: push.listId, route: JSON.stringify(push.route) };
  if (push.feedId) data.feedId = push.feedId;

  return {
    tokens,
    notification: { title: push.title, body: shortenBody(push.body) },
    data,
    android: {
      notification: { channelId: push.channelId, ...(push.tag && { tag: push.tag }) },
    },
  };
}

/**
 * Corta o texto da notificação em PUSH_BODY_LIMIT caracteres, no último espaço quando houver um
 * perto do fim, terminando com reticências. Comentários longos continuam inteiros na Atividade.
 *
 * @param body - Texto da notificação.
 * @returns O texto, cortado se passar do limite.
 */
function shortenBody(body: string): string {
  const characters = [...body];
  if (characters.length <= PUSH_BODY_LIMIT) return body;
  const head = characters.slice(0, PUSH_BODY_LIMIT - 1).join('');
  const lastSpace = head.lastIndexOf(' ');
  const cut = lastSpace >= PUSH_BODY_LIMIT * 0.7 ? head.slice(0, lastSpace) : head;
  return `${cut.trimEnd().replace(/[\s.,;:!?“"]+$/u, '')}…`;
}

export { sendFcm, shortenBody };
