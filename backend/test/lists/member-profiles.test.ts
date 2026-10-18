import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  isSameProfile,
  MAX_MEMBER_NAME_LENGTH,
  MAX_PHOTO_URL_LENGTH,
  toMemberProfile,
} from '../../lib/lists/member-profiles.js';

describe('toMemberProfile (sem emulador)', () => {
  test('nome aparado e foto https', () => {
    const profile = toMemberProfile({ displayName: '  Ana Souza ', photoURL: 'https://lh3.googleusercontent.com/a/x' });
    assert.deepEqual(profile, { name: 'Ana Souza', photoUrl: 'https://lh3.googleusercontent.com/a/x' });
  });

  test('sem nome nem foto: nome vazio e foto null', () => {
    assert.deepEqual(toMemberProfile({}), { name: '', photoUrl: null });
  });

  test('foto que não é https, malformada ou longa demais vira null', () => {
    const longUrl = `https://exemplo.com/${'a'.repeat(MAX_PHOTO_URL_LENGTH)}`;
    for (const photoURL of ['http://exemplo.com/foto.jpg', 'nao e url', 'data:image/png;base64,AAAA', longUrl]) {
      assert.equal(toMemberProfile({ displayName: 'Ana', photoURL }).photoUrl, null, photoURL);
    }
  });

  test('foto https de exatamente 500 caracteres é aceita', () => {
    const prefix = 'https://exemplo.com/';
    const photoURL = prefix + 'a'.repeat(MAX_PHOTO_URL_LENGTH - prefix.length);
    assert.equal(toMemberProfile({ displayName: 'Ana', photoURL }).photoUrl, photoURL);
  });

  test('nome longo é cortado', () => {
    const profile = toMemberProfile({ displayName: 'x'.repeat(MAX_MEMBER_NAME_LENGTH + 20) });
    assert.equal(profile.name.length, MAX_MEMBER_NAME_LENGTH);
  });
});

describe('isSameProfile (sem emulador)', () => {
  const ana = { name: 'Ana', photoUrl: null };

  test('ausente é diferente', () => {
    assert.equal(isSameProfile(undefined, ana), false);
  });

  test('compara nome e foto', () => {
    assert.equal(isSameProfile({ name: 'Ana', photoUrl: null }, ana), true);
    assert.equal(isSameProfile({ name: 'Ana S.', photoUrl: null }, ana), false);
    assert.equal(isSameProfile({ name: 'Ana', photoUrl: 'https://exemplo.com/a.jpg' }, ana), false);
  });
});
