import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildGenreTaste,
  candidateFeatures,
  scoreByGenreTaste,
  scoreByTmdbVote,
  scoreWithModel,
} from '../../lib/discover/score-candidates.js';
import type { DiscoverCandidate } from '../../lib/discover/tmdb-discover-client.js';

/** Green Book (490132) como veio na gravação discover-comedia-lgbt.json. */
const greenBook: DiscoverCandidate = {
  tmdbId: 490132,
  title: 'Green Book: O Guia',
  year: 2018,
  posterPath: '/u9dldwRwQjTZGlIxKaAtAPLAjOv.jpg',
  genreIds: [18, 35, 36],
  vote: 8.224,
  votes: 13382,
  popularity: 41.4745,
};

describe('candidateFeatures', () => {
  test('gêneros em pt-BR, década, nota, votos, popularidade e palavras-chave quando há', () => {
    const features = candidateFeatures(greenBook, { runtime: 130, providers: [], keywords: ['road trip'] });
    assert.equal(features['genre:Drama'], 1);
    assert.equal(features['genre:Comédia'], 1);
    assert.equal(features['genre:História'], 1);
    assert.equal(features['decade:2010'], 1);
    assert.equal(features.vote, 0.8224);
    assert.ok((features.votesLog ?? 0) > 0.8 && (features.votesLog ?? 0) <= 1);
    assert.ok((features.popularityLog ?? 0) > 0 && (features.popularityLog ?? 0) < 1);
    assert.equal(features['keyword:road trip'], 1);
  });
});

describe('scoreWithModel', () => {
  test('sigmoide do viés mais os pesos; o motivo cita o que mais pesou a favor', () => {
    const model = { bias: -1, weights: { 'genre:Comédia': 1.5, 'decade:2010': 0.5, vote: 1, 'genre:Terror': -2 } };
    const { score, reason } = scoreWithModel(model, candidateFeatures(greenBook));
    // logit = -1 + 1,5 + 0,5 + 0,8224 = 1,8224
    assert.equal(score, Math.round(100 / (1 + Math.exp(-1.8224))));
    assert.equal(reason, 'Pesa a favor no gosto de vocês: Comédia e anos 2010');
  });

  test('nada a favor: motivo honesto', () => {
    const { reason } = scoreWithModel({ bias: 0, weights: { 'genre:Comédia': -1 } }, candidateFeatures(greenBook));
    assert.equal(reason, 'Pouco em comum com o que vocês põem no topo');
  });
});

describe('scoreByGenreTaste', () => {
  const taste = buildGenreTaste([['Terror'], ['Terror', 'Comédia'], ['Drama'], ['Terror']]);

  test('frequência de cada gênero entre os primeiros da lista', () => {
    assert.deepEqual(Object.fromEntries(taste), { Terror: 0.75, Comédia: 0.25, Drama: 0.25 });
  });

  test('1 − Π(1 − frequência), citando até dois gêneros em comum', () => {
    assert.deepEqual(scoreByGenreTaste(taste, ['Comédia', 'Terror']), {
      score: Math.round(100 * (1 - 0.25 * 0.75)),
      reason: 'Terror e Comédia: gêneros que vocês põem no topo',
    });
    assert.deepEqual(scoreByGenreTaste(taste, ['Drama']), {
      score: 25,
      reason: 'Drama: gênero que vocês põem no topo',
    });
  });

  test('nenhum gênero em comum: 0 e o motivo diz isso', () => {
    assert.deepEqual(scoreByGenreTaste(taste, ['Faroeste']), {
      score: 0,
      reason: 'Fora dos gêneros que vocês põem no topo',
    });
  });
});

describe('scoreByTmdbVote', () => {
  test('nota do TMDb × 10', () => {
    assert.deepEqual(scoreByTmdbVote(greenBook, false), { score: 82, reason: 'Nota do TMDb' });
    assert.equal(scoreByTmdbVote({ ...greenBook, vote: null }, true).reason, 'Nota do TMDb (a lista ainda está vazia)');
  });
});
