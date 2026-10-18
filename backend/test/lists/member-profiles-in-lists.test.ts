import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { FieldValue } from 'firebase-admin/firestore';
import { deleteListRoute } from '../../api/lists/[listId]/index.js';
import { leaveListRoute } from '../../api/lists/[listId]/leave.js';
import { createListRoute } from '../../api/lists/index.js';
import { joinListRoute } from '../../api/lists/join.js';
import { INVITE_LIFETIME_MS } from '../../lib/lists/invite-codes.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators, signUp } from '../support/emulators.js';
import { fakeSources } from '../support/fake-sources.js';
import { jsonRequest } from '../support/requests.js';

type Person = { uid: string; idToken: string };
type CreatedList = { listId: string; inviteCode: string };

const ANA_PHOTO = 'https://lh3.googleusercontent.com/a/ana';

let clock: Date;
let dependencies: ReturnType<typeof createTestDependencies>;
let ana: Person;
let bia: Person;
let carla: Person;

beforeEach(async () => {
  await resetEmulators();
  clock = new Date('2026-10-16T15:00:00Z');
  dependencies = createTestDependencies(fakeSources().fetch, () => clock);
  [ana, bia, carla] = await Promise.all([
    signUp('ana@exemplo.com'),
    signUp('bia@exemplo.com'),
    signUp('carla@exemplo.com'),
  ]);
  await dependencies.auth.updateUser(ana.uid, { displayName: 'Ana', photoURL: ANA_PHOTO });
  await dependencies.auth.updateUser(bia.uid, { displayName: 'Bia' });
  await dependencies.auth.updateUser(carla.uid, { displayName: 'Carla', photoURL: 'http://exemplo.com/carla.jpg' });
});

const withDependencies = () => dependencies;
const createList = async (person: Person) =>
  (await (
    await createListRoute(withDependencies)(jsonRequest('/api/lists', { name: 'Maratona' }, person.idToken))
  ).json()) as CreatedList;
const join = (person: Person, code: string) =>
  joinListRoute(withDependencies)(jsonRequest('/api/lists/join', { code }, person.idToken));
const leave = (person: Person, listId: string) =>
  leaveListRoute(withDependencies)(jsonRequest(`/api/lists/${listId}/leave?listId=${listId}`, {}, person.idToken));
const remove = (person: Person, listId: string) =>
  deleteListRoute(withDependencies)(
    new Request(`http://localhost/api/lists/${listId}?listId=${listId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${person.idToken}` },
    }),
  );
const listOf = async (listId: string) => (await dependencies.db.doc(`lists/${listId}`).get()).data();

describe('memberProfiles ao criar a lista', () => {
  test('a dona entra com nome e foto do Google', async () => {
    const { listId } = await createList(ana);
    assert.deepEqual((await listOf(listId))?.memberProfiles, { [ana.uid]: { name: 'Ana', photoUrl: ANA_PHOTO } });
  });
});

describe('memberProfiles ao entrar', () => {
  test('memberUids e memberProfiles mudam juntos, na mesma gravação', async () => {
    const { listId, inviteCode } = await createList(ana);

    assert.equal((await join(bia, inviteCode)).status, 200);

    const list = await listOf(listId);
    assert.deepEqual(list?.memberUids, [ana.uid, bia.uid]);
    assert.deepEqual(list?.memberProfiles, {
      [ana.uid]: { name: 'Ana', photoUrl: ANA_PHOTO },
      [bia.uid]: { name: 'Bia', photoUrl: null },
    });
    assert.equal(list?.updatedAt.toMillis(), clock.getTime());
  });

  test('foto que não é https fica null', async () => {
    const { listId, inviteCode } = await createList(ana);
    await join(carla, inviteCode);
    assert.deepEqual((await listOf(listId))?.memberProfiles?.[carla.uid], { name: 'Carla', photoUrl: null });
  });

  test('duas pessoas entrando ao mesmo tempo: as duas ficam em memberUids e memberProfiles', async () => {
    const { listId, inviteCode } = await createList(ana);

    const responses = await Promise.all([join(bia, inviteCode), join(carla, inviteCode)]);

    assert.deepEqual(
      responses.map((response) => response.status),
      [200, 200],
    );
    const list = await listOf(listId);
    assert.deepEqual([...(list?.memberUids ?? [])].sort(), [ana.uid, bia.uid, carla.uid].sort());
    assert.deepEqual(Object.keys(list?.memberProfiles ?? {}).sort(), [ana.uid, bia.uid, carla.uid].sort());
  });

  test('convite vencido: nem memberUids nem memberProfiles mudam', async () => {
    const { listId, inviteCode } = await createList(ana);
    clock = new Date(clock.getTime() + INVITE_LIFETIME_MS);

    assert.equal((await join(bia, inviteCode)).status, 410);

    const list = await listOf(listId);
    assert.deepEqual(list?.memberUids, [ana.uid]);
    assert.deepEqual(Object.keys(list?.memberProfiles ?? {}), [ana.uid]);
  });

  test('quem já é integrante não regrava nada', async () => {
    const { listId, inviteCode } = await createList(ana);
    await join(bia, inviteCode);
    const before = await dependencies.db.doc(`lists/${listId}`).get();

    await join(bia, inviteCode);

    const after = await dependencies.db.doc(`lists/${listId}`).get();
    assert.equal(after.updateTime?.toMillis(), before.updateTime?.toMillis());
  });
});

describe('memberProfiles ao sair e ao apagar', () => {
  test('quem sai perde a chave; a outra continua', async () => {
    const { listId, inviteCode } = await createList(ana);
    await join(bia, inviteCode);

    assert.equal((await leave(bia, listId)).status, 200);

    const list = await listOf(listId);
    assert.deepEqual(list?.memberUids, [ana.uid]);
    assert.deepEqual(list?.memberProfiles, { [ana.uid]: { name: 'Ana', photoUrl: ANA_PHOTO } });
  });

  test('a dona sai: a posse passa e a chave dela some', async () => {
    const { listId, inviteCode } = await createList(ana);
    await join(bia, inviteCode);

    await leave(ana, listId);

    const list = await listOf(listId);
    assert.equal(list?.ownerUid, bia.uid);
    assert.deepEqual(Object.keys(list?.memberProfiles ?? {}), [bia.uid]);
  });

  test('sair de uma lista antiga, sem memberProfiles, funciona', async () => {
    const { listId, inviteCode } = await createList(ana);
    await join(bia, inviteCode);
    await dependencies.db.doc(`lists/${listId}`).update({ memberProfiles: FieldValue.delete() });

    assert.equal((await leave(bia, listId)).status, 200);
    assert.equal((await listOf(listId))?.memberProfiles, undefined);
  });

  test('apagar a lista leva os perfis e a fila junto', async () => {
    const { listId } = await createList(ana);
    await dependencies.db.doc(`lists/${listId}/queue/2756`).set({ tmdbId: 2756, addedBy: ana.uid, createdAt: clock });

    assert.equal((await remove(ana, listId)).status, 204);

    assert.equal((await dependencies.db.doc(`lists/${listId}`).get()).exists, false);
    assert.equal((await dependencies.db.collection(`lists/${listId}/queue`).get()).size, 0);
  });
});
