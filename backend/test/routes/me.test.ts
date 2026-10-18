import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { meRoute } from '../../api/me.js';
import { createTestDependencies } from '../support/dependencies.js';
import { resetEmulators, signUp } from '../support/emulators.js';
import { fakeSources } from '../support/fake-sources.js';
import { getRequest, withBearer } from '../support/requests.js';

const getMe = meRoute(() => createTestDependencies(fakeSources().fetch));

beforeEach(resetEmulators);

describe('GET /api/me (autenticação)', () => {
  test('sem Authorization: 401 "token ausente"', async () => {
    const response = await getMe(getRequest('/api/me'));

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: { code: 'unauthenticated', message: 'token ausente' } });
  });

  test('esquema diferente de Bearer: 401', async () => {
    const response = await getMe(getRequest('/api/me', { headers: { authorization: 'Basic abc' } }));
    assert.equal(response.status, 401);
  });

  test('token que não é do Firebase: 401 "token inválido"', async () => {
    const response = await getMe(getRequest('/api/me', withBearer('nao-e-um-token')));

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: { code: 'unauthenticated', message: 'token inválido' } });
  });

  test('token válido: 200 com o uid', async () => {
    const { uid, idToken } = await signUp('pessoa@exemplo.com');
    const response = await getMe(getRequest('/api/me', withBearer(idToken)));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { uid, profileSynced: 0 });
  });
});
