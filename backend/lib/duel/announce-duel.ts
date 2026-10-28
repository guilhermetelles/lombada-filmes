import { readEntriesWithPositions } from '../events/list-entries.js';
import { listDocument } from '../lists/list-repository.js';
import { logger } from '../logging/logger.js';
import { readNotifyPrefs } from '../notify/prefs.js';
import { sendFcm } from '../notify/send-fcm.js';
import type { Dependencies } from '../types/dependencies.js';
import type { DuelView } from '../types/duel.js';
import { openDuel } from './open-duel.js';

/** O que o aviso avulso fez: o duelo do dia e quem foi avisado ou ficou de fora. */
export type DuelAnnouncement = { duel: DuelView; pushed: string[]; skipped: string[] };

/**
 * Avisa agora todos os membros do duelo de hoje, fora da notificação diária: abre o duelo (ou usa o
 * par já gravado no dia) e manda "Duelo de revisão" com o mesmo texto do `daily.duel`. Não grava o
 * notifyLog, então a notificação diária de cada pessoa continua valendo. Quem desligou o duelo nas
 * preferências fica de fora.
 *
 * @param dependencies - Banco, FCM e relógio.
 * @param listId - Lista.
 * @returns O duelo e os uids avisados e pulados.
 * @throws {NotFoundError} Se a lista não existir ou tiver menos de dois filmes.
 */
async function announceDuel(dependencies: Dependencies, listId: string): Promise<DuelAnnouncement> {
  const { db } = dependencies;
  const list = (await listDocument(db, listId).get()).data();
  const duel = await openDuel(dependencies, { uid: list?.ownerUid ?? '', listId });
  const { entries } = await readEntriesWithPositions(db, listId, [duel.entryIdA, duel.entryIdB]);
  const describe = (entryId: string) => {
    const entry = entries.find((found) => found.entryId === entryId);
    return entry ? `${entry.movie.title} (#${entry.position})` : 'o filme';
  };

  const report: DuelAnnouncement = { duel, pushed: [], skipped: [] };
  for (const member of list?.memberUids ?? []) {
    try {
      if (!(await readNotifyPrefs(db, member)).types.duel) {
        report.skipped.push(member);
        continue;
      }
      const { sent } = await sendFcm(dependencies, member, {
        title: 'Duelo de revisão',
        body: `Vocês ainda acham que ${describe(duel.entryIdA)} é melhor que ${describe(duel.entryIdB)}?`,
        listId,
        route: { name: 'duel', args: { entryId: duel.entryIdA, entryIdB: duel.entryIdB } },
        channelId: 'lista',
      });
      (sent > 0 ? report.pushed : report.skipped).push(member);
    } catch (error) {
      logger.warn('aviso avulso do duelo não saiu', { listId, member, error });
      report.skipped.push(member);
    }
  }
  return report;
}

export { announceDuel };
