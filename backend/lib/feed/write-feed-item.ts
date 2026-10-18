import type { Firestore } from 'firebase-admin/firestore';
import { createIfAbsent } from '../firestore/idempotent.js';
import { FeedItemSchema } from '../schemas/feed.js';
import type { FeedItem } from '../types/feed.js';
import { feedCollection } from './feed-repository.js';

/** Item gravado: o id dele (vai no push) e se foi criado agora. */
type WrittenFeedItem = { feedId: string; created: boolean };

/**
 * Grava um item na Atividade da lista. Com id determinístico (ex.: quiz-winner-2026-10,
 * retro-2026-10, daily-{uid}-{dia}), usa create() e não duplica se a rotina rodar de novo; sem id,
 * o Firestore gera um.
 *
 * @param db - Firestore.
 * @param listId - Lista da Atividade.
 * @param item - Item pronto, com textos só de dados reais.
 * @param feedId - Id determinístico, para eventos que só podem acontecer uma vez.
 * @returns O id do item e se ele foi criado agora (false quando o id já existia).
 * @throws {ZodError} Se o item estiver fora do formato do contrato (erro de programação).
 */
async function writeFeedItem(db: Firestore, listId: string, item: FeedItem, feedId?: string): Promise<WrittenFeedItem> {
  const valid = FeedItemSchema.parse(item);
  const ref = feedId ? feedCollection(db, listId).doc(feedId) : feedCollection(db, listId).doc();
  const created = await createIfAbsent(ref, valid);
  return { feedId: ref.id, created };
}

export { writeFeedItem };
