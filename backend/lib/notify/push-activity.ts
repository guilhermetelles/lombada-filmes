import { logger } from '../logging/logger.js';
import type { Dependencies } from '../types/dependencies.js';
import type { RouteRef } from '../types/feed.js';
import { claimActivityPush } from './activity-push-quota.js';
import { sendFcm } from './send-fcm.js';

/** O aviso de atividade que vai a um integrante: o item da Atividade que ele resume e o texto. */
type ActivityPush = {
  recipient: string;
  listId: string;
  feedId: string;
  title: string;
  body: string;
  route: RouteRef;
  now: Date;
};

/**
 * Manda um aviso de atividade da lista a um integrante, se notifyState liberar (preferência ligada,
 * intervalo de 15 minutos e máximo diário). Agrupado, vai com a tag `activity-{listId}`, que
 * substitui o aviso anterior no aparelho. Uma falha só vai para o log.
 *
 * @param dependencies - Banco e FCM.
 * @param push - Destinatário, lista, item da Atividade, texto, rota e momento.
 * @returns true se o FCM aceitou o aviso em algum aparelho.
 */
async function pushActivity(
  dependencies: Pick<Dependencies, 'db' | 'messaging'>,
  { recipient, listId, feedId, title, body, route, now }: ActivityPush,
): Promise<boolean> {
  try {
    const claim = await claimActivityPush(dependencies.db, recipient, now);
    if (!claim) return false;
    const { sent } = await sendFcm(dependencies, recipient, {
      title,
      body,
      listId,
      feedId,
      route,
      channelId: 'lista',
      tag: claim.grouped ? `activity-${listId}` : undefined,
    });
    return sent > 0;
  } catch (error) {
    logger.warn('aviso de atividade não enviado', { recipient, listId, error });
    return false;
  }
}

export { pushActivity };
