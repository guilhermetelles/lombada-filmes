import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { createListRoute } from '../../api/lists/index.js';
import { joinListRoute } from '../../api/lists/join.js';
import { meRoute } from '../../api/me.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators, signUp } from '../support/emulators.js';
import { fakeSources } from '../support/fake-sources.js';
import { getRequest, jsonRequest, withBearer } from '../support/requests.js';

type Person = { uid: string; idToken: string };
type CreatedList = { listId: string; inviteCode: string };

let dependencies: ReturnType<typeof createTestDependencies>;
let ana: Person;
let bia: Person;

beforeEach(async () => {
  await resetEmulators();
  dependencies = createTestDependencies(fakeSources().fetch, () => new Date('2026-10-16T15:00:00Z'));
  [ana, bia] = await Promise.all([signUp('ana@exemplo.com'), signUp('bia@exemplo.com')]);
  await dependencies.auth.updateUser(ana.uid, { displayName: 'Ana' });
  await dependencies.auth.updateUser(bia.uid, { displayName: 'Bia' });
});

const withDependencies = () => dependencies;
const getMe = (person: Person) => meRoute(withDependencies)(getRequest('/api/me', withBearer(person.idToken)));
const readMe = async (person: Person) => (await (await getMe(person)).json()) as { uid: string; profileSynced: number };
const createList = async (person: Person, name: string) =>
  (await (
    await createListRoute(withDependencies)(jsonRequest('/api/lists', { name }, person.idToken))
  ).json()) as CreatedList;
const join = (person: Person, code: string) =>
  joinListRoute(withDependencies)(jsonRequest('/api/lists/join', { code }, person.idToken));
const profilesOf = async (listId: string) =>
  (await dependencies.db.doc(`lists/${listId}`).get()).get('memberProfiles') as Record<
    string,
    { name: string; photoUrl: string | null }
  >;

describe('GET /api/me', () => {
  test('sem token: 401', async () => {
    assert.equal((await meRoute(withDependencies)(getRequest('/api/me'))).status, 401);
  });

  test('sem listas: uid e profileSynced 0', async () => {
    const response = await getMe(ana);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { uid: ana.uid, profileSynced: 0 });
  });

  test('perfil já igual: não grava nada', async () => {
    const { listId } = await createList(ana, 'Maratona');
    const before = await dependencies.db.doc(`lists/${listId}`).get();

    assert.deepEqual(await readMe(ana), { uid: ana.uid, profileSynced: 0 });

    const after = await dependencies.db.doc(`lists/${listId}`).get();
    assert.equal(after.updateTime?.toMillis(), before.updateTime?.toMillis());
  });

  test('nome e foto novos vão para todas as listas da pessoa, e só para a chave dela', async () => {
    const first = await createList(ana, 'Maratona');
    const second = await createList(bia, 'Terror');
    await join(ana, second.inviteCode);
    await createList(bia, 'Só da Bia');
    await dependencies.auth.updateUser(ana.uid, { displayName: 'Ana Souza', photoURL: 'https://exemplo.com/ana.jpg' });

    assert.deepEqual(await readMe(ana), { uid: ana.uid, profileSynced: 2 });

    const expected = { name: 'Ana Souza', photoUrl: 'https://exemplo.com/ana.jpg' };
    assert.deepEqual((await profilesOf(first.listId))[ana.uid], expected);
    assert.deepEqual(await profilesOf(second.listId), {
      [bia.uid]: { name: 'Bia', photoUrl: null },
      [ana.uid]: expected,
    });
    // A segunda chamada não acha nada mudado.
    assert.equal((await readMe(ana)).profileSynced, 0);
  });

  test('lista antiga sem memberProfiles ganha o perfil', async () => {
    await dependencies.db.doc('lists/antiga').set({
      name: 'Antiga',
      description: '',
      ownerUid: ana.uid,
      memberUids: [ana.uid],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    assert.equal((await readMe(ana)).profileSynced, 1);
    assert.deepEqual(await profilesOf('antiga'), { [ana.uid]: { name: 'Ana', photoUrl: null } });
  });

  test('foto http é guardada como null', async () => {
    const { listId } = await createList(ana, 'Maratona');
    await dependencies.auth.updateUser(ana.uid, { photoURL: 'http://exemplo.com/ana.jpg' });

    assert.equal((await readMe(ana)).profileSynced, 0);
    assert.equal((await profilesOf(listId))[ana.uid]?.photoUrl, null);
  });
});
