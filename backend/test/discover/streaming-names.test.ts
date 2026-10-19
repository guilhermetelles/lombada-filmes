import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { normalizeStreamingServices } from '../../lib/discover/streaming-names.js';

describe('normalizeStreamingServices', () => {
  test('tira o canal da Amazon quando o serviço base está na lista', () => {
    assert.deepEqual(normalizeStreamingServices(['HBO Max', 'HBO Max Amazon Channel', 'Netflix']), [
      'HBO Max',
      'Netflix',
    ]);
  });

  test('canal sem o serviço base fica, com o nome original', () => {
    assert.deepEqual(normalizeStreamingServices(['MGM+ Amazon Channel', 'Netflix']), [
      'MGM+ Amazon Channel',
      'Netflix',
    ]);
  });

  test('Paramount+, Paramount Plus e planos viram um serviço só', () => {
    assert.deepEqual(
      normalizeStreamingServices([
        'Paramount Plus',
        'Paramount+',
        'Paramount Plus Premium',
        'Paramount+ Amazon Channel',
        'Paramount Plus Apple TV Channel',
      ]),
      ['Paramount Plus'],
    );
  });

  test('planos com anúncio e outros nomes aceitos viram o serviço conhecido', () => {
    assert.deepEqual(
      normalizeStreamingServices([
        'Netflix basic with Ads',
        'Netflix',
        'Max',
        'Apple TV+',
        'Amazon Prime Video with Ads',
      ]),
      ['Netflix', 'HBO Max', 'Apple TV', 'Amazon Prime Video'],
    );
  });

  test('lista vazia ou sem repetidos fica igual', () => {
    assert.deepEqual(normalizeStreamingServices([]), []);
    assert.deepEqual(normalizeStreamingServices(['Globoplay', 'MUBI']), ['Globoplay', 'MUBI']);
  });
});
