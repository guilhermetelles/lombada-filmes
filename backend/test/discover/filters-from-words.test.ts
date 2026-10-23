import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { filtersFromWords, mentionsReleaseEra } from '../../lib/discover/filters-from-words.js';

describe('filtersFromWords', () => {
  test('palavras de curto e de longo, com e sem acento', () => {
    for (const text of ['comédia curta', 'um terror curtinho pra hoje', 'algo leve e rápido', 'RAPIDINHO']) {
      assert.deepEqual(filtersFromWords(text), { dur: ['ate90'] }, text);
    }
    for (const text of ['um épico longo', 'filmes longos', 'uma aventura épica']) {
      assert.deepEqual(filtersFromWords(text), { dur: ['mais120'] }, text);
    }
  });

  test('"um longa" é longa-metragem, não duração', () => {
    assert.deepEqual(filtersFromWords('um longa de terror'), {});
  });

  test('décadas em dois ou quatro dígitos, e as antigas viram antes70', () => {
    assert.deepEqual(filtersFromWords('terror trash anos 80'), { dec: ['1980'] });
    assert.deepEqual(filtersFromWords('comédia dos anos 1990 ou anos 90'), { dec: ['1990'] });
    assert.deepEqual(filtersFromWords('filme de tubarão dos anos 2000'), { dec: ['2000'] });
    assert.deepEqual(filtersFromWords('musical da década de 50'), { dec: ['antes70'] });
    assert.deepEqual(filtersFromWords('anos 80 e anos 2010'), { dec: ['1980', '2010'] });
  });

  test('sem palavra fixa, nada', () => {
    assert.deepEqual(filtersFromWords('quero ver algo bom, faz uns 10 anos que não vejo'), {});
  });
});

describe('mentionsReleaseEra', () => {
  test('palavras de época de lançamento, com e sem acento', () => {
    for (const text of [
      'comédia dos anos 90',
      'um clássico',
      'algo antigo',
      'terror recente',
      'lançamentos de 2024',
      'filme de 1995',
      'da década de 80',
    ]) {
      assert.ok(mentionsReleaseEra(text), text);
    }
  });

  test('futuro, passado e assunto não são época de lançamento', () => {
    for (const text of ['romance futuro', 'filme sobre o passado', 'drama medieval', 'romance com robô']) {
      assert.ok(!mentionsReleaseEra(text), text);
    }
  });
});
