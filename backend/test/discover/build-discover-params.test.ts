import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildDiscoverParams } from '../../lib/discover/build-discover-params.js';

/**
 * Monta a consulta e devolve os parâmetros como objeto, para comparar.
 *
 * @param filters - Filtros.
 * @param page - Página.
 * @returns Parâmetros, grupos de gêneros e faixa de duração a conferir.
 */
function plan(filters: Parameters<typeof buildDiscoverParams>[0], page = 1) {
  const { params, requiredGenreGroups, runtimeRange } = buildDiscoverParams(filters, page);
  return { params: Object.fromEntries(params), requiredGenreGroups, runtimeRange };
}

const BASE = {
  language: 'pt-BR',
  region: 'BR',
  include_adult: 'false',
  include_video: 'false',
  sort_by: 'popularity.desc',
  'vote_count.gte': '50',
  page: '1',
};

describe('buildDiscoverParams', () => {
  test('sem filtros: só região, idioma, ordem, votos mínimos e página', () => {
    assert.deepEqual(plan({}, 3), {
      params: { ...BASE, page: '3' },
      requiredGenreGroups: [],
      runtimeRange: { min: null, max: null },
    });
  });

  test('"comédia com casal gay": gênero e palavras-chave LGBT+ conferidas no TMDb', () => {
    assert.deepEqual(plan({ genre: ['Comédia'], theme: ['lgbt'] }).params, {
      ...BASE,
      with_genres: '35',
      with_keywords: '158718|264386|250606|290527|363345',
    });
  });

  test('gêneros por nome, sem acento ou por apelido; desconhecidos ficam de fora', () => {
    assert.equal(
      plan({ genre: ['comedia', 'Suspense', 'Ficção científica', 'Novela'] }).params.with_genres,
      '35|53|878',
    );
  });

  test('humor "leve": gêneros leves e exclusão de terror, thriller, crime e guerra', () => {
    const { params } = plan({ mood: ['leve'] });
    assert.equal(params.with_genres, '35|16|10751|10749');
    assert.equal(params.without_genres, '27,53,80,10752');
  });

  test('gênero escolhido e humor com gêneros: o humor é conferido depois, nos resultados', () => {
    assert.deepEqual(plan({ genre: ['Comédia'], mood: ['tenso'] }), {
      params: { ...BASE, with_genres: '35' },
      requiredGenreGroups: [[53, 27, 9648]],
      runtimeRange: { min: null, max: null },
    });
  });

  test('a exclusão do humor não tira um gênero escolhido', () => {
    assert.equal(plan({ genre: ['Terror'], mood: ['leve'] }).params.without_genres, '53,80,10752');
  });

  test('vários humores: só restringe o que todos têm', () => {
    // "leve" é por gêneros e "cult" por palavras-chave: nenhum dos dois restringe sozinho.
    assert.deepEqual(plan({ mood: ['leve', 'cult'] }).params, BASE);
    assert.equal(plan({ mood: ['leve', 'tenso'] }).params.with_genres, '35|16|10751|10749|53|27|9648');
  });

  test('palavras-chave do humor só entram sem tema', () => {
    assert.equal(plan({ mood: ['ruim-divertido'] }).params.with_keywords, '323812|11034|155493|11931');
    assert.equal(plan({ mood: ['ruim-divertido'], theme: ['halloween'] }).params.with_keywords, '3335');
  });

  test('durações e décadas viram uma faixa só', () => {
    const { params } = plan({ dur: ['ate90', '90a120'], dec: ['1980', '1990'] });
    assert.equal(params['with_runtime.gte'], undefined);
    assert.equal(params['with_runtime.lte'], '120');
    assert.equal(params['primary_release_date.gte'], '1980-01-01');
    assert.equal(params['primary_release_date.lte'], '1999-12-31');
    assert.deepEqual(plan({ dur: ['ate90', '90a120'] }).runtimeRange, { min: null, max: 120 });
    assert.equal(plan({ dur: ['mais120'] }).params['with_runtime.gte'], '121');
    assert.equal(plan({ dec: ['antes70'] }).params['primary_release_date.lte'], '1969-12-31');
  });

  test('serviços por nome ou apelido, por assinatura no Brasil', () => {
    const { params } = plan({ svc: ['Netflix', 'prime video', 'Disney+', 'Desconhecido'] });
    assert.equal(params.with_watch_providers, '8|119|337');
    assert.equal(params.watch_region, 'BR');
    assert.equal(params.with_watch_monetization_types, 'flatrate');
    assert.equal(plan({ svc: ['Desconhecido'] }).params.with_watch_providers, undefined);
  });
});
