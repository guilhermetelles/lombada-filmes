import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitFromIndex } from '../../lib/recs/compute-list-recs.js';
import { movieFeatures } from '../../lib/recs/movie-features.js';
import { buildListIndex, type ListFilmWithMovie, scoreMovie } from '../../lib/recs/score-recs.js';
import { modelScore } from '../../lib/recs/train-model.js';
import type { Movie } from '../../lib/types/movie.js';
import { seededRandom, syntheticCatalog } from './synthetic-movies.js';

/** Quantos filmes a lista sintética tem, quantos ficam de fora e quantos candidatos entram. */
const LIST_SIZE = 90;
const HELD_OUT = 15;
const CANDIDATES = 200;

/**
 * Fração dos filmes que ficam acima da mediana das notas dos candidatos.
 *
 * @param held - Notas dos filmes separados.
 * @param candidates - Notas dos candidatos.
 * @returns De 0 a 1.
 */
function fractionAboveMedian(held: readonly number[], candidates: readonly number[]): number {
  const sorted = [...candidates].sort((a, b) => a - b);
  const median =
    ((sorted[Math.floor((sorted.length - 1) / 2)] ?? 0) + (sorted[Math.ceil((sorted.length - 1) / 2)] ?? 0)) / 2;
  return held.filter((score) => score > median).length / held.length;
}

/**
 * Avaliação offline com dados sintéticos (não de produção): a dupla escolhe o que ver pelo gosto
 * escondido e ordena pela mesma utilidade, com ruído; o modelo treina sem os 15 últimos vistos
 * (por watchedOn) e conta quantos deles ficam acima da mediana dos candidatos. A linha de base é a
 * nota do TMDb. Roda em várias sementes e relata a média.
 */
test('avaliação offline: os 15 últimos vistos ficam acima da mediana dos candidatos mais que pela nota do TMDb', (t) => {
  const results = { full: [] as number[], model: [] as number[], baseline: [] as number[], alpha: [] as number[] };

  for (const seed of [7, 11, 23, 42, 99]) {
    const random = seededRandom(seed * 31);
    const catalog = syntheticCatalog(800, seed);
    // A dupla vê o que mais combina, com ruído na escolha.
    const chosen = [...catalog]
      .map((item) => ({ item, pull: item.utility + (random() - 0.5) * 2 }))
      .sort((a, b) => b.pull - a.pull)
      .slice(0, LIST_SIZE)
      .map(({ item }) => item);
    const chosenIds = new Set(chosen.map((item) => item.tmdbId));
    const ranked = [...chosen]
      .map((item) => ({ item, order: item.utility + (random() - 0.5) * 0.8 }))
      .sort((a, b) => b.order - a.order)
      .map(({ item }, index) => ({
        ...item,
        position: index + 1,
        watchedOn: `2025-${String(1 + Math.floor(random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(random() * 28)).padStart(2, '0')}`,
      }));

    const byWatched = [...ranked].sort((a, b) => a.watchedOn.localeCompare(b.watchedOn) || a.tmdbId - b.tmdbId);
    const heldOut = byWatched.slice(-HELD_OUT);
    const heldIds = new Set(heldOut.map((item) => item.tmdbId));
    const training = ranked.filter((item) => !heldIds.has(item.tmdbId));
    const films: ListFilmWithMovie[] = training.map((item, index) => ({
      entryId: `e${item.tmdbId}`,
      tmdbId: item.tmdbId,
      position: index + 1,
      comment: '',
      watchedOn: item.watchedOn,
      movie: item.movie,
    }));
    const index = buildListIndex(films, films.length);
    const fitted = fitFromIndex(index);
    const candidates = catalog.filter((item) => !chosenIds.has(item.tmdbId)).slice(0, CANDIDATES);

    const full = (tmdbId: number, movie: Movie) => scoreMovie(fitted.model, index, tmdbId, movie, 'model').score;
    const model = (movie: Movie) => modelScore(fitted.model, movieFeatures(movie));
    const baseline = (movie: Movie) => (movie.vote ?? 0) * 10;
    results.full.push(
      fractionAboveMedian(
        heldOut.map((item) => full(item.tmdbId, item.movie)),
        candidates.map((item) => full(item.tmdbId, item.movie)),
      ),
    );
    results.model.push(
      fractionAboveMedian(
        heldOut.map((item) => model(item.movie)),
        candidates.map((item) => model(item.movie)),
      ),
    );
    results.baseline.push(
      fractionAboveMedian(
        heldOut.map((item) => baseline(item.movie)),
        candidates.map((item) => baseline(item.movie)),
      ),
    );
    results.alpha.push(fitted.alpha);
  }

  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const format = (values: number[]) =>
    `${(100 * mean(values)).toFixed(1)}% (${values.map((v) => v.toFixed(2)).join(', ')})`;
  t.diagnostic(`modelo + vizinhos: ${format(results.full)}`);
  t.diagnostic(`só o modelo: ${format(results.model)}`);
  t.diagnostic(`linha de base (nota do TMDb): ${format(results.baseline)}`);
  t.diagnostic(`alfa (peso do modelo aprendido): ${results.alpha.map((a) => a.toFixed(2)).join(', ')}`);

  assert.ok(mean(results.full) > mean(results.baseline), 'o motor precisa ganhar da nota do TMDb');
  assert.ok(mean(results.full) >= 0.7, 'pelo menos 70% dos últimos vistos acima da mediana dos candidatos');
});
