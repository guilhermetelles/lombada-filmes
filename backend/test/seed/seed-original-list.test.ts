import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { ORIGINAL_LETTERBOXD_URL, ORIGINAL_LIST_ID, seedOriginalList } from '../../lib/seed/seed-original-list.js';
import type { OriginalEntry } from '../../lib/types/seed.js';
import { UsageMeter } from '../../lib/usage/usage-meter.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators } from '../support/emulators.js';
import { fakeSources } from '../support/fake-sources.js';

const OWNER = 'uid-da-dona';
const listInfo = { name: 'Competição de filmes terríveis', description: 'Os filmes que vimos' };
const abyss: OriginalEntry = { position: 1, tmdbId: 2756, watchedOn: '2025-10-12', comment: 'ESSE FILME É INCRÍVEL' };

let dependencies: ReturnType<typeof createTestDependencies>;

beforeEach(async () => {
  await resetEmulators();
  dependencies = createTestDependencies(fakeSources().fetch, () => new Date('2026-10-16T15:00:00Z'));
});

const seed = (entries: OriginalEntry[] = [abyss]) =>
  seedOriginalList({ dependencies, usage: new UsageMeter(), ownerUid: OWNER, listInfo, entries });
const entryDocument = () => dependencies.db.doc(`lists/${ORIGINAL_LIST_ID}/entries/tmdb-2756`);

describe('carga da lista original', () => {
  test('cria a lista da dona com a origem no Letterboxd, a entrada, o filme e um convite', async () => {
    const summary = await seed();

    assert.equal(summary.listCreated, true);
    assert.equal(summary.entriesCreated, 1);
    assert.match(summary.inviteCode, /^[A-Z2-9]{6}$/);

    const list = (await dependencies.db.doc(`lists/${ORIGINAL_LIST_ID}`).get()).data();
    assert.deepEqual(
      [list?.name, list?.ownerUid, list?.memberUids, list?.source.letterboxdUrl],
      [listInfo.name, OWNER, [OWNER], ORIGINAL_LETTERBOXD_URL],
    );

    const entry = (await entryDocument().get()).data();
    assert.deepEqual(
      [entry?.tmdbId, entry?.rankKey, entry?.watchedOn, entry?.comment, entry?.addedBy, entry?.updatedBy],
      [2756, 'a0', '2025-10-12', 'ESSE FILME É INCRÍVEL', OWNER, OWNER],
    );
    assert.deepEqual(entry?.movie.directors, [{ id: 2710, name: 'James Cameron' }]);
    assert.equal((await dependencies.db.doc('movies/2756').get()).exists, true);
  });

  test('rodar de novo não duplica, não regrava comentário editado e reaproveita o convite', async () => {
    const first = await seed();
    await entryDocument().update({ comment: 'Editado pelo app' });

    const second = await seed();

    assert.deepEqual([second.listCreated, second.entriesCreated, second.entriesKept], [false, 0, 1]);
    assert.equal((await entryDocument().get()).get('comment'), 'Editado pelo app');
    assert.equal(second.inviteCode, first.inviteCode);
    assert.equal((await dependencies.db.collection(`lists/${ORIGINAL_LIST_ID}/entries`).get()).size, 1);
  });
});
