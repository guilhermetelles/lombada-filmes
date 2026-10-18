import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { translateAwardsSummary } from '../../lib/sources/omdb/translate-awards-summary.js';

describe('translateAwardsSummary', () => {
  test('vitórias no Oscar e totais', () => {
    assert.equal(
      translateAwardsSummary('Won 4 Oscars. 42 wins & 52 nominations total'),
      'Ganhou 4 Oscars. 42 prêmios e 52 indicações no total',
    );
  });

  test('indicação, singular e outras premiações', () => {
    assert.equal(
      translateAwardsSummary('Nominated for 1 Oscar. 1 win & 1 nomination total'),
      'Indicado a 1 Oscar. 1 prêmio e 1 indicação no total',
    );
    assert.equal(translateAwardsSummary('Won 2 Golden Globes. 3 wins'), 'Ganhou 2 Globos de Ouro. 3 prêmios');
    assert.equal(
      translateAwardsSummary('Won 1 BAFTA Film Award. 5 nominations total'),
      'Ganhou 1 BAFTA. 5 indicações no total',
    );
  });

  test('frase desconhecida fica de fora; nada reconhecido vira null', () => {
    assert.equal(translateAwardsSummary('Won 1 Hugo Award. 2 wins total'), '2 prêmios no total');
    assert.equal(translateAwardsSummary('Something else'), null);
    assert.equal(translateAwardsSummary(null), null);
  });
});
