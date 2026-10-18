import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { feedCollection } from '../../lib/feed/feed-repository.js';
import { writeFeedItem } from '../../lib/feed/write-feed-item.js';
import type { FeedItem } from '../../lib/types/feed.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators } from '../support/emulators.js';
import { fakeSources } from '../support/fake-sources.js';

const { db } = createTestDependencies(fakeSources().fetch);
const createdAt = new Date('2026-11-01T08:30:00Z');

/** Item mínimo do vencedor do mês, com os campos opcionais ausentes. */
const winnerItem: FeedItem = {
  type: 'quiz.winner',
  kind: 'quiz',
  createdAt,
  title: 'Placar de outubro fechado',
  body: undefined,
  route: { name: 'quiz', args: { month: '2026-10', day: undefined } },
};

beforeEach(resetEmulators);

describe('writeFeedItem', () => {
  test('com id determinístico, a segunda gravação não duplica', async () => {
    const first = await writeFeedItem(db, 'lista-1', winnerItem, 'quiz-winner-2026-10');
    const second = await writeFeedItem(db, 'lista-1', { ...winnerItem, title: 'outro' }, 'quiz-winner-2026-10');

    assert.deepEqual(first, { feedId: 'quiz-winner-2026-10', created: true });
    assert.deepEqual(second, { feedId: 'quiz-winner-2026-10', created: false });

    const items = await feedCollection(db, 'lista-1').get();
    assert.equal(items.size, 1);
    // Os campos undefined não vão para o banco, e a leitura valida pelo schema.
    assert.deepEqual(items.docs[0]?.data(), {
      type: 'quiz.winner',
      kind: 'quiz',
      createdAt,
      title: 'Placar de outubro fechado',
      route: { name: 'quiz', args: { month: '2026-10' } },
    });
  });

  test('sem id, o Firestore gera um a cada gravação', async () => {
    const first = await writeFeedItem(db, 'lista-1', winnerItem);
    const second = await writeFeedItem(db, 'lista-1', winnerItem);

    assert.notEqual(first.feedId, second.feedId);
    assert.equal((await feedCollection(db, 'lista-1').get()).size, 2);
  });

  test('item fora do contrato é recusado antes de gravar', async () => {
    const invalid = { ...winnerItem, kind: 'outro' } as unknown as FeedItem;
    await assert.rejects(writeFeedItem(db, 'lista-1', invalid));
    assert.equal((await feedCollection(db, 'lista-1').get()).size, 0);
  });
});
