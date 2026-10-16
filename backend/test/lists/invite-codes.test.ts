import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  generateInviteCode,
  INVITE_ALPHABET,
  INVITE_CODE_LENGTH,
  inviteExpiration,
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

  test('vencem 7 dias depois de criados', () => {
    const now = new Date('2026-10-16T12:00:00Z');
    assert.equal(inviteExpiration(now).toISOString(), '2026-10-23T12:00:00.000Z');
  });
});
