import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DEFAULT_NOTIFY_PREFS } from '../../lib/notify/default-notify-prefs.js';
import { NotifyStateSchema } from '../../lib/schemas/notify.js';
import {
  DiscoverQuery,
  ListEventsBody,
  NotifyPrefsBody,
  QuizAnswerParams,
  SearchQuery,
} from '../../lib/schemas/route-inputs.js';

describe('DiscoverQuery', () => {
  test('listas separadas por vírgula, fit e página', () => {
    const parsed = DiscoverQuery.parse({ mood: 'leve, cult', dec: '1980', fit: 'true', page: '2', listId: 'abc' });
    assert.deepEqual(parsed, {
      listId: 'abc',
      mood: ['leve', 'cult'],
      dec: ['1980'],
      fit: true,
      page: 2,
      lang: 'pt-BR',
    });
  });

  test('sem nada: página 1 e filtros ausentes', () => {
    const parsed = DiscoverQuery.parse({});
    assert.equal(parsed.page, 1);
    assert.equal(parsed.mood, undefined);
    assert.equal(parsed.fit, undefined);
  });

  test('valor fora da lista é recusado', () => {
    assert.equal(DiscoverQuery.safeParse({ mood: 'feliz' }).success, false);
    assert.equal(DiscoverQuery.safeParse({ page: '501' }).success, false);
    assert.equal(DiscoverQuery.safeParse({ lang: 'es' }).success, false);
  });

  test('lang=en pede os títulos em inglês (en-US); sem lang, pt-BR', () => {
    assert.equal(DiscoverQuery.parse({ lang: 'en' }).lang, 'en-US');
    assert.equal(DiscoverQuery.parse({}).lang, 'pt-BR');
  });
});

describe('SearchQuery', () => {
  test('lang opcional: pt-BR por padrão, en-US com lang=en', () => {
    assert.deepEqual(SearchQuery.parse({ q: 'abismo' }), { q: 'abismo', lang: 'pt-BR' });
    assert.deepEqual(SearchQuery.parse({ q: 'abyss', lang: 'en' }), { q: 'abyss', lang: 'en-US' });
    assert.equal(SearchQuery.safeParse({ q: 'abyss', lang: 'english' }).success, false);
  });
});

describe('ListEventsBody', () => {
  test('aceita até 50 eventos e recusa lote vazio', () => {
    const item = { type: 'moved', entryId: 'e1' };
    assert.equal(ListEventsBody.safeParse({ items: Array(50).fill(item) }).success, true);
    assert.equal(ListEventsBody.safeParse({ items: Array(51).fill(item) }).success, false);
    assert.equal(ListEventsBody.safeParse({ items: [] }).success, false);
  });
});

describe('QuizAnswerParams', () => {
  test('o dia deve ser AAAA-MM-DD', () => {
    assert.equal(QuizAnswerParams.safeParse({ listId: 'abc', day: '2026-10-18' }).success, true);
    assert.equal(QuizAnswerParams.safeParse({ listId: 'abc', day: '18-10-2026' }).success, false);
  });
});

describe('NotifyPrefs', () => {
  test('o padrão passa no schema e vale quando notifyState não tem prefs', () => {
    assert.deepEqual(NotifyPrefsBody.parse(DEFAULT_NOTIFY_PREFS), DEFAULT_NOTIFY_PREFS);
    assert.deepEqual(NotifyStateSchema.parse({}).prefs, DEFAULT_NOTIFY_PREFS);
  });

  test('horário fora dos quatro aceitos é recusado', () => {
    assert.equal(NotifyPrefsBody.safeParse({ ...DEFAULT_NOTIFY_PREFS, hour: 10 }).success, false);
  });
});
