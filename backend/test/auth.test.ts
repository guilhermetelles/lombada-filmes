import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { GET } from '../api/me.js';
import { request, resetEmulators, signUp } from './emulators.js';

beforeEach(resetEmulators);

test('sem Authorization: 401', async () => {
  const res = await GET(request('/api/me'));
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: 'token ausente' });
});

test('esquema diferente de Bearer: 401', async () => {
  const res = await GET(request('/api/me', { headers: { authorization: 'Basic abc' } }));
  assert.equal(res.status, 401);
});

test('token que não é um JWT do Firebase: 401', async () => {
  const res = await GET(request('/api/me', { headers: { authorization: 'Bearer nao-e-um-token' } }));
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: 'token inválido' });
});

test('token válido: 200 com o uid', async () => {
  const { uid, idToken } = await signUp('pessoa@exemplo.com');
  const res = await GET(request('/api/me', { headers: { authorization: `Bearer ${idToken}` } }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { uid });
});
