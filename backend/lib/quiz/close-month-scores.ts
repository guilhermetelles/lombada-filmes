import { writeFeedItem } from '../feed/write-feed-item.js';
import { logger } from '../logging/logger.js';
import { readNotifyPrefs } from '../notify/prefs.js';
import { sendFcm } from '../notify/send-fcm.js';
import type { Dependencies } from '../types/dependencies.js';
import type { List } from '../types/list.js';
import { scoresDocument } from './quiz-repository.js';
import { joinPt, monthLabel } from './quiz-text.js';
import { quizScoresWinners } from './quiz-winners.js';

/** Resultado do fechamento do placar de um mês numa lista. */
export type MonthScoresOutcome = {
  winnerUids: string[]; // vazio: sem vencedor (1 membro ou ninguém pontuou)
  closedNow: boolean; // false se o mês já estava fechado
  feedCreated: boolean; // item quiz.winner gravado agora
  pushed: number; // aparelhos que receberam o aviso
};

/**
 * Fecha o placar do mês: grava `winnerUids` em scores/{mês} só se ainda não houver (empate: todos os
 * empatados; lista com 1 membro ou sem pontos: lista vazia, sem vencedor). Com vencedor, grava o item
 * `quiz.winner` da Atividade (id `quiz-winner-{mês}`) e, só quando o item é criado agora, avisa os
 * membros que deixaram o quiz ligado nas notificações (canal quiz).
 *
 * @param dependencies - Banco, FCM e relógio.
 * @param listId - Lista.
 * @param list - Documento da lista (membros e nomes).
 * @param month - Mês a fechar (AAAA-MM).
 * @returns Vencedores e o que foi gravado agora.
 */
async function closeMonthScores(
  dependencies: Dependencies,
  listId: string,
  list: List,
  month: string,
): Promise<MonthScoresOutcome> {
  const { db, now } = dependencies;
  const ref = scoresDocument(db, listId, month);
  const { winnerUids, points, closedNow } = await db.runTransaction(async (transaction) => {
    const stored = (await transaction.get(ref)).data();
    if (stored?.winnerUids) return { winnerUids: stored.winnerUids, points: stored.points, closedNow: false };
    const points = stored?.points ?? {};
    const winnerUids = quizScoresWinners(list.memberUids, points);
    transaction.set(ref, { points, winnerUids });
    return { winnerUids, points, closedNow: true };
  });

  const outcome: MonthScoresOutcome = { winnerUids, closedNow, feedCreated: false, pushed: 0 };
  if (winnerUids.length === 0) return outcome;

  const label = monthLabel(month);
  const names = winnerUids.map((uid) => list.memberProfiles?.[uid]?.name ?? '').filter(Boolean);
  const title =
    winnerUids.length > 1
      ? `Empate no quiz de ${label}${names.length > 0 ? `: ${joinPt(names)}` : ''}`
      : `${names[0] ?? 'Quem mais acertou'} venceu o quiz de ${label}`;
  const best = points[winnerUids[0] ?? ''] ?? 0;
  const body = `${best} pontos no placar do mês.`;
  const route = { name: 'quiz' as const };

  const { feedId, created } = await writeFeedItem(
    db,
    listId,
    { type: 'quiz.winner', kind: 'quiz', createdAt: now(), title, body, route },
    `quiz-winner-${month}`,
  );
  outcome.feedCreated = created;
  if (!created) return outcome;

  for (const uid of list.memberUids) {
    try {
      if (!(await readNotifyPrefs(db, uid)).types.quiz) continue;
      const result = await sendFcm(dependencies, uid, { title, body, listId, feedId, route, channelId: 'quiz' });
      outcome.pushed += result.sent;
    } catch (error) {
      logger.warn('aviso do vencedor do quiz não saiu', { listId, uid, error });
    }
  }
  return outcome;
}

export { closeMonthScores };
