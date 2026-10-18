import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { migrateMemberProfiles } from '../../lib/lists/migrate-member-profiles.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators, signUp } from '../support/emulators.js';
import { fakeSources } from '../support/fake-sources.js';

const NOW = new Date('2026-10-16T15:00:00Z');

let dependencies: ReturnType<typeof createTestDependencies>;
let ana: string;
let bia: string;

beforeEach(async () => {
  await resetEmulators();
  dependencies = createTestDependencies(fakeSources().fetch, () => NOW);
  const [first, second] = await Promise.all([signUp('ana@exemplo.com'), signUp('bia@exemplo.com')]);
  ana = first.uid;
  bia = second.uid;
  await dependencies.auth.updateUser(ana, { displayName: 'Ana', photoURL: 'https://exemplo.com/ana.jpg' });
  await dependencies.auth.updateUser(bia, { displayName: 'Bia' });
});

/**
 * Grava uma lista como as da versão 0.2 (sem memberProfiles).
 *
 * @param id - Id da lista.
 * @param memberUids - Integrantes.
 */
async function oldList(id: string, memberUids: string[]): Promise<void> {
  await dependencies.db.doc(`lists/${id}`).set({
    name: id,
    description: '',
    ownerUid: memberUids[0],
    memberUids,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

const profilesOf = async (id: string) => (await dependencies.db.doc(`lists/${id}`).get()).get('memberProfiles');

describe('migrateMemberProfiles', () => {
  test('--dry-run conta o que falta e não grava nada', async () => {
    await oldList('dupla', [ana, bia]);

    const report = await migrateMemberProfiles(dependencies, { dryRun: true });

    assert.equal(report.lists, 1);
    assert.equal(report.changes.length, 2);
    assert.equal(report.written, 0);
    assert.equal(await profilesOf('dupla'), undefined);
  });

  test('preenche as listas antigas e, rodando de novo, não grava nada', async () => {
    await oldList('dupla', [ana, bia]);
    await oldList('solo', [ana]);

    const first = await migrateMemberProfiles(dependencies, { dryRun: false });
    const second = await migrateMemberProfiles(dependencies, { dryRun: false });

    assert.deepEqual([first.lists, first.written], [2, 3]);
    assert.deepEqual([second.changes.length, second.written], [0, 0]);
    assert.deepEqual(await profilesOf('dupla'), {
      [ana]: { name: 'Ana', photoUrl: 'https://exemplo.com/ana.jpg' },
      [bia]: { name: 'Bia', photoUrl: null },
    });
    assert.deepEqual(await profilesOf('solo'), { [ana]: { name: 'Ana', photoUrl: 'https://exemplo.com/ana.jpg' } });
  });

  test('perfil desatualizado é regravado; o certo fica como está', async () => {
    await oldList('dupla', [ana, bia]);
    await dependencies.db.doc('lists/dupla').update({
      memberProfiles: {
        [ana]: { name: 'Ana', photoUrl: 'https://exemplo.com/ana.jpg' },
        [bia]: { name: 'B', photoUrl: null },
      },
    });

    const report = await migrateMemberProfiles(dependencies, { dryRun: false });

    assert.deepEqual(
      report.changes.map(({ uid }) => uid),
      [bia],
    );
    assert.equal(report.written, 1);
    assert.deepEqual((await profilesOf('dupla'))[bia], { name: 'Bia', photoUrl: null });
  });
});
