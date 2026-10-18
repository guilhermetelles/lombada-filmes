import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  addMonths,
  formatMoney,
  joinPt,
  maskTitleWords,
  monthLabel,
  pickSentenceExcerpt,
} from '../../lib/quiz/quiz-text.js';
import { quizScoresWinners } from '../../lib/quiz/quiz-winners.js';
import { createSeededRandom, shuffle } from '../../lib/quiz/seeded-random.js';

describe('textos do quiz', () => {
  test('maskTitleWords esconde palavras dos títulos, com plural, sem mexer em palavras curtas', () => {
    assert.equal(
      maskTitleWords('Abyss é o melhor, e os abismos também', ['The Abyss', 'O Segredo do Abismo']),
      '▇▇▇ é o melhor, e os ▇▇▇ também',
    );
    assert.equal(maskTitleWords("Ocean's tem onze ladrões", ["Ocean's Eleven"]), '▇▇▇ tem onze ladrões');
    assert.equal(maskTitleWords('the end', ['The End']), 'the end');
  });

  test('pickSentenceExcerpt escolhe frases verbatim dentro dos limites', () => {
    const comment = 'Curta. Esta frase tem tamanho suficiente para virar um trecho do quiz diário. Fim.';
    const excerpt = pickSentenceExcerpt(comment, createSeededRandom('x'));
    assert.ok(excerpt && comment.includes(excerpt));
    assert.equal(pickSentenceExcerpt('Curta demais.', createSeededRandom('x')), undefined);
  });

  test('meses, valores e listas por extenso', () => {
    assert.equal(monthLabel('2026-10'), 'outubro de 2026');
    assert.equal(addMonths('2026-01', -1), '2025-12');
    assert.equal(addMonths('2026-11', 3), '2027-02');
    assert.equal(formatMoney(70_000_000), 'US$ 70 milhões');
    assert.equal(formatMoney(1_200_000_000), 'US$ 1,2 bilhão');
    assert.equal(formatMoney(800_000), 'US$ 800 mil');
    assert.equal(joinPt(['a', 'b', 'c']), 'a, b e c');
    assert.equal(joinPt(['a']), 'a');
  });

  test('o sorteio com semente é sempre igual para a mesma semente', () => {
    const items = [1, 2, 3, 4, 5, 6];
    assert.deepEqual(shuffle(items, createSeededRandom('dia')), shuffle(items, createSeededRandom('dia')));
    assert.notDeepEqual(shuffle(items, createSeededRandom('dia')), shuffle(items, createSeededRandom('outro dia')));
  });
});

describe('quizScoresWinners', () => {
  test('quem tem mais pontos vence', () => {
    assert.deepEqual(quizScoresWinners(['ana', 'bia'], { ana: 30, bia: 20 }), ['ana']);
  });

  test('empate: todos os empatados', () => {
    assert.deepEqual(quizScoresWinners(['ana', 'bia'], { ana: 30, bia: 30 }), ['ana', 'bia']);
  });

  test('1 membro ou ninguém pontuou: sem vencedor', () => {
    assert.deepEqual(quizScoresWinners(['ana'], { ana: 50 }), []);
    assert.deepEqual(quizScoresWinners(['ana', 'bia'], {}), []);
  });

  test('pontos de quem saiu da lista não contam', () => {
    assert.deepEqual(quizScoresWinners(['ana', 'bia'], { ana: 10, saiu: 90 }), ['ana']);
  });
});
