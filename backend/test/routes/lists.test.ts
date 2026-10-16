import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { deleteListRoute } from '../../api/lists/[listId]/index.js';
import { createInviteRoute } from '../../api/lists/[listId]/invites.js';
import { leaveListRoute } from '../../api/lists/[listId]/leave.js';
import { createListRoute } from '../../api/lists/index.js';
import { joinListRoute } from '../../api/lists/join.js';
import { INVITE_LIFETIME_MS } from '../../lib/lists/invite-codes.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators, signUp } from '../support/emulators.js';
import { fakeSources } from '../support/fake-sources.js';
import { jsonRequest, readErrorCode } from '../support/requests.js';

type Person = { uid: string; idToken: string };
type CreatedList = { listId: string; inviteCode: string; expiresAt: string };

let clock: Date;
let dependencies: ReturnType<typeof createTestDependencies>;
let owner: Person;
let friend: Person;
let outsider: Person;

beforeEach(async () => {
  await resetEmulators();
  clock = new Date('2026-10-16T15:00:00Z');
  dependencies = createTestDependencies(fakeSources().fetch, () => clock);
  [owner, friend, outsider] = await Promise.all([
    signUp('dona@exemplo.com'),
    signUp('amiga@exemplo.com'),
    signUp('de-fora@exemplo.com'),
  ]);
});

const withDependencies = () => dependencies;
const createList = (person: Person, body: unknown = { name: 'Maratona', description: 'Filmes ruins' }) =>
  createListRoute(withDependencies)(jsonRequest('/api/lists', body, person.idToken));
const join = (person: Person, code: string) =>
  joinListRoute(withDependencies)(jsonRequest('/api/lists/join', { code }, person.idToken));
const newInvite = (person: Person, listId: string) =>
  createInviteRoute(withDependencies)(jsonRequest(`/api/lists/${listId}/invites?listId=${listId}`, {}, person.idToken));
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
const inviteCount = async (listId: string) =>
  (await dependencies.db.collection('invites').where('listId', '==', listId).get()).size;

/** Cria uma lista da dona com a amiga já dentro e devolve o id. */
async function sharedList(): Promise<string> {
  const { listId, inviteCode } = (await (await createList(owner)).json()) as CreatedList;
  await join(friend, inviteCode);
  return listId;
}

describe('POST /api/lists', () => {
  test('cria a lista com a dona como única integrante e um convite de 7 dias', async () => {
    const response = await createList(owner);
    const created = (await response.json()) as CreatedList;

    assert.equal(response.status, 201);
    assert.match(created.inviteCode, /^[A-Z2-9]{6}$/);
    assert.equal(new Date(created.expiresAt).getTime(), clock.getTime() + INVITE_LIFETIME_MS);
    const list = await listOf(created.listId);
    assert.deepEqual(
      { name: list?.name, description: list?.description, ownerUid: list?.ownerUid, memberUids: list?.memberUids },
      { name: 'Maratona', description: 'Filmes ruins', ownerUid: owner.uid, memberUids: [owner.uid] },
    );
    const invite = (await dependencies.db.doc(`invites/${created.inviteCode}`).get()).data();
    assert.equal(invite?.listId, created.listId);
  });

  test('descrição é opcional e os textos são aparados', async () => {
    const created = (await (await createList(owner, { name: '  Terror  ' })).json()) as CreatedList;
    const list = await listOf(created.listId);
    assert.deepEqual([list?.name, list?.description], ['Terror', '']);
  });

  test('nome vazio, longo demais ou corpo que não é JSON: 400', async () => {
    for (const body of [{ name: '   ' }, { name: 'x'.repeat(81) }, { description: 'sem nome' }]) {
      const response = await createList(owner, body);
      assert.equal(response.status, 400, JSON.stringify(body));
      assert.equal(await readErrorCode(response), 'invalid_input');
    }
    const notJson = new Request('http://localhost/api/lists', {
      method: 'POST',
      headers: { authorization: `Bearer ${owner.idToken}` },
      body: 'nome=Maratona',
    });
    assert.equal((await createListRoute(withDependencies)(notJson)).status, 400);
  });

  test('sem token: 401 e nada criado', async () => {
    const response = await createListRoute(withDependencies)(jsonRequest('/api/lists', { name: 'Maratona' }));
    assert.equal(response.status, 401);
    assert.equal((await dependencies.db.collection('lists').get()).size, 0);
  });
});

describe('POST /api/lists/join', () => {
  test('código válido: entra na lista e o uso fica registrado no convite', async () => {
    const { listId, inviteCode } = (await (await createList(owner)).json()) as CreatedList;

    const response = await join(friend, inviteCode);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      listId,
      name: 'Maratona',
      description: 'Filmes ruins',
      alreadyMember: false,
    });
    assert.deepEqual((await listOf(listId))?.memberUids, [owner.uid, friend.uid]);
    const invite = (await dependencies.db.doc(`invites/${inviteCode}`).get()).data();
    assert.deepEqual(invite?.usedBy, [friend.uid]);
  });

  test('aceita o código como o app mostra ("ABC-DEF") e em minúsculas', async () => {
    const { listId, inviteCode } = (await (await createList(owner)).json()) as CreatedList;
    const typed = `${inviteCode.slice(0, 3)}-${inviteCode.slice(3)}`.toLowerCase();

    assert.equal((await join(friend, typed)).status, 200);
    assert.deepEqual((await listOf(listId))?.memberUids, [owner.uid, friend.uid]);
  });

  test('quem já é integrante só recebe a lista, sem duplicar', async () => {
    const { listId, inviteCode } = (await (await createList(owner)).json()) as CreatedList;

    const response = await join(owner, inviteCode);

    assert.equal(((await response.json()) as { alreadyMember: boolean }).alreadyMember, true);
    assert.deepEqual((await listOf(listId))?.memberUids, [owner.uid]);
  });

  test('código inexistente: 404', async () => {
    const response = await join(friend, 'ZZZZZZ');
    assert.equal(response.status, 404);
    assert.equal(await readErrorCode(response), 'not_found');
  });

  test('código vencido: 410 e a pessoa não entra', async () => {
    const { listId, inviteCode } = (await (await createList(owner)).json()) as CreatedList;
    clock = new Date(clock.getTime() + INVITE_LIFETIME_MS);

    const response = await join(friend, inviteCode);

    assert.equal(response.status, 410);
    assert.equal(await readErrorCode(response), 'invite_expired');
    assert.deepEqual((await listOf(listId))?.memberUids, [owner.uid]);
  });

  test('código malformado: 400', async () => {
    assert.equal((await join(friend, 'ABC')).status, 400);
  });
});

describe('POST /api/lists/{listId}/invites', () => {
  test('integrante gera um código novo, diferente do primeiro', async () => {
    const { listId, inviteCode } = (await (await createList(owner)).json()) as CreatedList;
    await join(friend, inviteCode);

    const response = await newInvite(friend, listId);
    const created = (await response.json()) as CreatedList;

    assert.equal(response.status, 201);
    assert.notEqual(created.inviteCode, inviteCode);
    assert.equal(await inviteCount(listId), 2);
  });

  test('quem não é integrante: 403; lista inexistente: 404', async () => {
    const listId = await sharedList();
    assert.equal((await newInvite(outsider, listId)).status, 403);
    assert.equal((await newInvite(owner, 'nao-existe')).status, 404);
  });
});

describe('POST /api/lists/{listId}/leave', () => {
  test('integrante sai e a lista continua', async () => {
    const listId = await sharedList();

    const response = await leave(friend, listId);

    assert.deepEqual(await response.json(), { listDeleted: false });
    assert.deepEqual((await listOf(listId))?.memberUids, [owner.uid]);
  });

  test('a dona sai: a posse passa para quem fica', async () => {
    const listId = await sharedList();

    await leave(owner, listId);

    const list = await listOf(listId);
    assert.deepEqual([list?.ownerUid, list?.memberUids], [friend.uid, [friend.uid]]);
  });

  test('última pessoa sai: a lista, as entradas e os convites são apagados', async () => {
    const { listId } = (await (await createList(owner)).json()) as CreatedList;
    await dependencies.db.doc(`lists/${listId}/entries/e1`).set({ tmdbId: 2756 });

    const response = await leave(owner, listId);

    assert.deepEqual(await response.json(), { listDeleted: true });
    assert.equal(await listOf(listId), undefined);
    assert.equal((await dependencies.db.collection(`lists/${listId}/entries`).get()).size, 0);
    assert.equal(await inviteCount(listId), 0);
  });

  test('quem não é integrante: 403', async () => {
    const listId = await sharedList();
    assert.equal((await leave(outsider, listId)).status, 403);
  });
});

describe('DELETE /api/lists/{listId}', () => {
  test('a dona apaga a lista, as entradas e os convites', async () => {
    const listId = await sharedList();
    await dependencies.db.doc(`lists/${listId}/entries/e1`).set({ tmdbId: 2756 });

    const response = await remove(owner, listId);

    assert.equal(response.status, 204);
    assert.equal(await listOf(listId), undefined);
    assert.equal((await dependencies.db.collection(`lists/${listId}/entries`).get()).size, 0);
    assert.equal(await inviteCount(listId), 0);
  });

  test('integrante que não é dona: 403 e nada é apagado', async () => {
    const listId = await sharedList();

    const response = await remove(friend, listId);

    assert.equal(response.status, 403);
    assert.equal(await readErrorCode(response), 'forbidden');
    assert.notEqual(await listOf(listId), undefined);
  });

  test('lista inexistente: 404; listId inválido: 400', async () => {
    assert.equal((await remove(owner, 'nao-existe')).status, 404);
    assert.equal((await remove(owner, 'id com espaço')).status, 400);
  });
});
