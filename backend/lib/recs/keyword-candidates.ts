import { resolveKeywords } from '../discover/resolve-keywords.js';
import type { RecsModel } from '../types/recs.js';
import { type KeywordSeed, readOrEmpty } from './gather-candidates.js';
import { META_KEYWORDS } from './keyword-labels.js';
import type { RecsRun } from './recs-run.js';

/** Peso mínimo do modelo (alpha) para as palavras-chave dele virarem fonte de candidatos. */
export const KEYWORD_MIN_ALPHA = 0.5;

/** De quantas palavras-chave buscar filmes. */
const KEYWORD_SOURCES = 3;

/** Peso mínimo de uma palavra-chave no modelo para ela contar. */
const MIN_KEYWORD_WEIGHT = 0.05;

/** Votos mínimos no TMDb de um filme achado por palavra-chave (tira os sem avaliação). */
const MIN_VOTES = 200;

/** Palavras-chave usadas e os filmes de cada uma. */
export type KeywordCandidates = { names: string[]; seeds: KeywordSeed[] };

/**
 * Busca candidatos pelas palavras-chave que mais pesam a favor no modelo da lista (as 3 de maior
 * peso positivo, fora as marcas técnicas e as sem rótulo em português): acha o id de cada uma no
 * TMDb (guardado em keywordIds/) e pede ao /discover os filmes mais populares com ela. Só com o
 * modelo confiável (alpha de 0,5 para cima) e enquanto houver tempo e pedidos na execução; uma
 * palavra que falhar fica de fora.
 *
 * @param run - Execução.
 * @param model - Modelo da lista, com os rótulos das palavras-chave.
 * @param alpha - Peso do modelo aprendido na mistura com a linha de base.
 * @returns As palavras usadas e os filmes de cada uma.
 */
async function keywordCandidates(run: RecsRun, model: RecsModel, alpha: number): Promise<KeywordCandidates> {
  const found: KeywordCandidates = { names: [], seeds: [] };
  if (alpha < KEYWORD_MIN_ALPHA) return found;

  const labels = model.labels ?? {};
  const chosen = Object.entries(model.weights)
    .flatMap(([feature, weight]) => {
      if (!feature.startsWith('keyword:') || weight <= MIN_KEYWORD_WEIGHT) return [];
      const name = feature.slice('keyword:'.length);
      const label = labels[name]?.trim();
      return META_KEYWORDS.has(name) || !label ? [] : [{ name, label, weight }];
    })
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name))
    .slice(0, KEYWORD_SOURCES);
  const strongest = chosen[0]?.weight ?? 1;
  const { db, sources, now } = run.dependencies;

  for (const { name, label, weight } of chosen) {
    if (!run.canFetch()) break;
    // Um termo por vez, para o id achado continuar ligado ao peso da palavra.
    const [keyword] = await resolveKeywords({ db, tmdb: sources.tmdbDiscover, usage: run.usage, now }, [
      { term: name, label },
    ]);
    if (!keyword || !run.canFetch()) continue;
    const movies = await readOrEmpty(
      async () =>
        (await run.usage.track('tmdb', () => sources.tmdbDiscover.discover(keywordParams(keyword.id)))).results,
    );
    if (movies.length === 0) continue;
    found.names.push(name);
    found.seeds.push({
      keywordId: keyword.id,
      weight: weight / strongest,
      tmdbIds: movies.map((movie) => movie.tmdbId),
    });
  }
  return found;
}

/**
 * Parâmetros do /discover/movie para os filmes de uma palavra-chave: os mais populares, com votos
 * suficientes, sem adulto nem vídeo.
 *
 * @param keywordId - Id da palavra-chave no TMDb.
 * @returns Os parâmetros.
 */
function keywordParams(keywordId: number): URLSearchParams {
  return new URLSearchParams({
    language: 'pt-BR',
    with_keywords: String(keywordId),
    sort_by: 'popularity.desc',
    'vote_count.gte': String(MIN_VOTES),
    include_adult: 'false',
    include_video: 'false',
    page: '1',
  });
}

export { keywordCandidates };
