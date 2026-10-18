import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { createIfAbsent } from '../../lib/firestore/idempotent.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators } from '../support/emulators.js';
import { fakeSources } from '../support/fake-sources.js';

const { db } = createTestDependencies(fakeSources().fetch);

beforeEach(resetEmulators);

describe('createIfAbsent', () => {
  test('cria na primeira vez; na segunda devolve false e não sobrescreve', async () => {
    const ref = db.doc('lists/lista-1/scores/2026-10');

    assert.equal(await createIfAbsent(ref, { points: { a: 1 } }), true);
    assert.equal(await createIfAbsent(ref, { points: { a: 99 } }), false);

    assert.deepEqual((await ref.get()).data(), { points: { a: 1 } });
  });
});
