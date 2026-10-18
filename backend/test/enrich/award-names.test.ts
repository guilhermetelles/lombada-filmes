import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { awardCategoryOf, awardOrgOf } from '../../lib/enrich/award-names.js';

describe('awardOrgOf', () => {
  test('premiações de cinema conhecidas, em português, pelo rótulo em pt ou en', () => {
    assert.equal(awardOrgOf('Oscar de melhor fotografia'), 'Oscar');
    assert.equal(awardOrgOf('Óscar de melhor ator'), 'Oscar');
    assert.equal(awardOrgOf('Academy Award for Best Picture'), 'Oscar');
    assert.equal(awardOrgOf('Golden Globe Award de melhor direção'), 'Globo de Ouro');
    assert.equal(awardOrgOf('BAFTA de Melhor Ator/Atriz em Ascensão'), 'BAFTA');
    assert.equal(awardOrgOf('Golden Raspberry Award for Worst Screenplay'), 'Framboesa de Ouro');
    assert.equal(awardOrgOf('Framboesa de Ouro de pior ator'), 'Framboesa de Ouro');
    assert.equal(awardOrgOf('Saturn Award for Best Director'), 'Saturn');
    assert.equal(awardOrgOf('Prêmio Saturno de melhor filme de ficção científica'), 'Saturn');
    assert.equal(awardOrgOf("Palme d'Or"), 'Cannes');
  });

  test('o que não é premiação de cinema da lista vira null', () => {
    assert.equal(awardOrgOf('Prêmio MTV Movie de Melhor Beijo'), null);
    assert.equal(awardOrgOf('estrela na calçada da fama de Hollywood'), null);
    assert.equal(awardOrgOf('Companheiro da Ordem do Canadá'), null);
    assert.equal(awardOrgOf('Teen Choice Award for Choice Movie Actor'), null);
  });
});

describe('awardCategoryOf', () => {
  test('categoria em português, em minúsculas, sem o nome da premiação', () => {
    assert.equal(awardCategoryOf('Oscar de melhor fotografia'), 'melhor fotografia');
    assert.equal(
      awardCategoryOf('Golden Globe Award de melhor atriz coadjuvante em cinema'),
      'melhor atriz coadjuvante',
    );
    assert.equal(awardCategoryOf('Oscar de Melhor Seleção de Elenco'), 'melhor seleção de elenco');
    assert.equal(awardCategoryOf('Framboesa de Ouro de pior ator coadjuvante'), 'pior ator coadjuvante');
    assert.equal(awardCategoryOf('Oscar de melhor diretor'), 'melhor direção');
  });

  test('termos de Portugal viram os do Brasil', () => {
    assert.equal(awardCategoryOf('Óscar de melhor ator secundário'), 'melhor ator coadjuvante');
    assert.equal(awardCategoryOf('Globo de Ouro de melhor banda sonora original'), 'melhor trilha sonora original');
  });

  test('rótulo em inglês traduzido pelo dicionário; fora dele, null', () => {
    assert.equal(awardCategoryOf('Saturn Award for Best Science Fiction Film'), 'melhor filme de ficção científica');
    assert.equal(awardCategoryOf('Saturn Award for Best Director'), 'melhor direção');
    assert.equal(awardCategoryOf('Academy Award for Best Visual Effects'), 'melhores efeitos visuais');
    assert.equal(awardCategoryOf('Golden Raspberry Award for Worst Screen Couple/Ensemble'), 'pior combinação em cena');
    assert.equal(awardCategoryOf('Saturn Award for Best Something Unheard Of'), null);
  });

  test('rótulo genérico vira null; prêmio com nome próprio fica com o nome', () => {
    assert.equal(awardCategoryOf('Saturn Award'), null);
    assert.equal(awardCategoryOf("Palme d'Or"), 'Palma de Ouro');
  });
});
