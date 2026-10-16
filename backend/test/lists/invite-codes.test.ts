import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  formatInviteCode,
  generateInviteCode,
  INVITE_ALPHABET,
  INVITE_CODE_LENGTH,
  newInvite,
  normalizeInviteCode,
} from '../../lib/lists/invite-codes.js';

describe('códigos de convite', () => {
  test('têm 6 caracteres do alfabeto sem 0, O, 1, I e L', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateInviteCode();
      assert.equal(code.length, INVITE_CODE_LENGTH);
      assert.match(code, /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);
    }
    assert.doesNotMatch(INVITE_ALPHABET, /[0O1IL]/);
  });

  test('usam o sorteio recebido', () => {
    assert.equal(
      generateInviteCode(() => 0),
      'AAAAAA',
    );
    assert.equal(
      generateInviteCode((size) => size - 1),
      '999999',
    );
  });

  test('um convite novo vence 7 dias depois de criado e ainda não tem uso', () => {
    const invite = newInvite('L1', 'uid', new Date('2026-10-16T12:00:00Z'));
    assert.deepEqual(invite, {
      listId: 'L1',
      createdBy: 'uid',
      expiresAt: new Date('2026-10-23T12:00:00Z'),
      usedBy: [],
    });
  });

  test('normaliza o que a pessoa digita e formata para mostrar', () => {
    assert.equal(normalizeInviteCode(' 7q4-kmx '), '7Q4KMX');
    assert.equal(formatInviteCode('7Q4KMX'), '7Q4-KMX');
  });
});
