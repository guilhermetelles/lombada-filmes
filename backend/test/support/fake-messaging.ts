import type { FirebaseError } from 'firebase-admin/app';
import type { BatchResponse, MulticastMessage, SendResponse } from 'firebase-admin/messaging';
import type { MessagingClient } from '../../lib/types/dependencies.js';

/** O FCM falso e o que ele registra. */
export type FakeMessaging = {
  messaging: MessagingClient;
  /** Mensagens recebidas, na ordem. */
  sent: MulticastMessage[];
  /** Tokens que o FCM falso recusa como não registrados (o envio apaga esses aparelhos). */
  unregistered: Set<string>;
  /** Outros erros por token: o FCM falso recusa o token com este código. */
  failures: Map<string, string>;
};

/**
 * Cria um FCM falso: aceita todo token, menos os de `unregistered`, que voltam com o erro
 * messaging/registration-token-not-registered, e os de `failures`, que voltam com o código dado.
 *
 * @returns O cliente, as mensagens recebidas e os tokens recusados.
 */
function createFakeMessaging(): FakeMessaging {
  const sent: MulticastMessage[] = [];
  const unregistered = new Set<string>();
  const failures = new Map<string, string>();

  const messaging: MessagingClient = {
    async sendEachForMulticast(message) {
      sent.push(message);
      const responses: SendResponse[] = message.tokens.map((token, index) => {
        const code = unregistered.has(token) ? 'messaging/registration-token-not-registered' : failures.get(token);
        return code
          ? { success: false, error: fcmError(code) }
          : { success: true, messageId: `mensagem-${sent.length}-${index}` };
      });
      const successCount = responses.filter((response) => response.success).length;
      const batch: BatchResponse = { responses, successCount, failureCount: responses.length - successCount };
      return batch;
    },
  };

  return { messaging, sent, unregistered, failures };
}

/**
 * Monta um erro no formato que o Admin SDK devolve por token.
 *
 * @param code - Código do erro do FCM.
 * @returns O erro.
 */
function fcmError(code: string): FirebaseError {
  const message = `FCM falso: ${code}`;
  return { code, message, toJSON: () => ({ code, message }) };
}

export { createFakeMessaging };
