import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { candidateFeatures, scoreWithModel } from '../../lib/discover/score-candidates.js';
import { movieFeatures } from '../../lib/recs/movie-features.js';
import {
  fitLearnedModel,
  fitListModel,
  MAX_FEATURES,
  modelScore,
  selectVocabulary,
} from '../../lib/recs/train-model.js';
import { makeMovie, syntheticCatalog } from './synthetic-movies.js';

describe('movieFeatures', () => {
  test('mesmos nomes e valores de candidateFeatures, para a busca avançada ler o modelo', () => {
    const movie = makeMovie({
      genres: ['Terror', 'Comédia'],
      year: 1987,
      vote: 7.1,
      votes: 5000,
      popularity: 12,
      keywords: ['zombie'],
    });
    const fromDiscover = candidateFeatures(
      {
        tmdbId: 1,
        title: 'x',
        year: 1987,
        posterPath: null,
        genreIds: [27, 35],
        vote: 7.1,
        votes: 5000,
        popularity: 12,
      },
      { runtime: null, providers: [], keywords: ['zombie'] },
    );
    assert.deepEqual(movieFeatures(movie), fromDiscover);
    assert.equal(movieFeatures(movie)['genre:Terror'], 1);
    assert.equal(movieFeatures(movie)['decade:1980'], 1);
  });
});

describe('selectVocabulary', () => {
  test('numéricas sempre; de 0 ou 1 só se aparecem em 2 ou mais filmes; até 300', () => {
    const vocabulary = selectVocabulary([
      { vote: 0.7, 'genre:Terror': 1, 'keyword:a': 1 },
      { vote: 0.5, 'genre:Terror': 1, 'keyword:b': 1 },
    ]);
    assert.deepEqual(vocabulary, ['vote', 'genre:Terror']);

    const many = Array.from({ length: 2 }, () =>
      Object.fromEntries(Array.from({ length: 400 }, (_, index) => [`keyword:k${index}`, 1])),
    );
    assert.equal(selectVocabulary(many).length, MAX_FEATURES);
  });
});

describe('fitListModel', () => {
  test('aprende a ordem dos pares: o gênero do topo pesa a favor, o do fim contra', () => {
    const top = Array.from({ length: 20 }, (_, index) =>
      movieFeatures(makeMovie({ genres: ['Terror'], vote: 6 + (index % 3) * 0.1 })),
    );
    const bottom = Array.from({ length: 20 }, (_, index) =>
      movieFeatures(makeMovie({ genres: ['Romance'], vote: 6 + (index % 3) * 0.1 })),
    );
    const learned = fitLearnedModel([...top, ...bottom]);
    assert.ok((learned.weights['genre:Terror'] ?? 0) > 0);
    assert.ok((learned.weights['genre:Romance'] ?? 0) < 0);
    // O viés põe o filme médio da lista em 50.
    const mean = [...top, ...bottom].reduce((sum, features) => sum + modelScore(learned, features), 0) / 40;
    assert.ok(Math.abs(mean - 50) < 10);
  });

  test('com menos de 5 filmes, só a linha de base (nota do TMDb)', () => {
    const fitted = fitListModel([movieFeatures(makeMovie({ genres: ['Terror'] }))]);
    assert.equal(fitted.alpha, 0);
    assert.deepEqual(fitted.model, { bias: -5.2, weights: { vote: 8 } });
    assert.equal(scoreWithModel(fitted.model, movieFeatures(makeMovie({ vote: 6.5 }))).score, 50);
    assert.ok(scoreWithModel(fitted.model, movieFeatures(makeMovie({ vote: 8 }))).score > 70);
  });

  test('lista pequena mistura com a linha de base; lista grande e coerente usa o modelo inteiro', () => {
    const catalog = syntheticCatalog(400, 5).sort((a, b) => b.utility - a.utility);
    const small = fitListModel(catalog.slice(0, 12).map(({ movie }) => movieFeatures(movie)));
    const large = fitListModel(
      catalog
        .filter((_, index) => index % 4 === 0)
        .slice(0, 90)
        .map(({ movie }) => movieFeatures(movie)),
    );
    assert.ok(small.alpha < 0.5, `alfa da lista pequena: ${small.alpha}`);
    assert.ok(large.alpha > 0.9, `alfa da lista grande: ${large.alpha}`);
    assert.ok((large.holdoutAccuracy ?? 0) > 0.62);
    assert.ok(Object.keys(large.model.weights).length <= MAX_FEATURES);
  });

  test('ranking sem relação com as variáveis não ganha peso (fica perto da linha de base)', () => {
    const catalog = syntheticCatalog(60, 9);
    // Ordem pelo id, que não tem nada a ver com as variáveis.
    const fitted = fitListModel(catalog.map(({ movie }) => movieFeatures(movie)));
    assert.ok(fitted.alpha < 0.6, `alfa: ${fitted.alpha}, acerto ${fitted.holdoutAccuracy}`);
  });
});
