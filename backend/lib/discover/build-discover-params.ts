import type { Filters } from '../types/discover.js';
import {
  DEC_RANGES,
  DUR_RANGES,
  genreIdByName,
  MOOD_QUERIES,
  streamingServiceByName,
  THEME_KEYWORDS,
} from './discover-vocabulary.js';

/** Votos mínimos no TMDb: tira filmes quase desconhecidos, cuja nota ainda não diz nada. */
export const MIN_VOTE_COUNT = 50;

/** Consulta ao /discover/movie e o que precisa ser conferido depois, nos resultados. */
export type DiscoverPlan = {
  params: URLSearchParams;
  /** Grupos de gêneros que o TMDb não consegue combinar na mesma consulta: cada filme precisa de um de cada. */
  requiredGenreGroups: number[][];
  /** Faixa de duração pedida (limites inclusivos; null é aberto), para conferir nos filmes com detalhes. */
  runtimeRange: { min: number | null; max: number | null };
};

/**
 * Monta a consulta ao /discover/movie para os filtros. Dentro de um grupo os valores valem como OU
 * (um filme de comédia OU de terror), e entre grupos como E (comédia E anos 90). O TMDb não aceita
 * misturar "|" e "," no mesmo parâmetro (testado: "a|b,c" vira "a,c"), então:
 * - gêneros escolhidos vão na consulta, e os gêneros do humor, se também houver, são conferidos
 *   depois em `genre_ids` (requiredGenreGroups);
 * - palavras-chave dos temas vão na consulta; as do humor só entram quando não há tema;
 * - com vários humores, só entra o que todos têm (gêneros, palavras-chave ou exclusões), para não
 *   restringir mais que o OU entre eles;
 * - várias durações ou décadas viram uma faixa só, do menor ao maior limite.
 * Gêneros e serviços desconhecidos são ignorados. A faixa de duração volta junto porque o filtro de
 * duração do TMDb deixa passar filmes cuja duração nos detalhes fica fora dela.
 *
 * @param filters - Filtros da busca.
 * @param page - Página do TMDb (1 a 500).
 * @returns A consulta e os grupos de gêneros a conferir nos resultados.
 */
export function buildDiscoverParams(filters: Filters, page: number): DiscoverPlan {
  const params = new URLSearchParams({
    language: 'pt-BR',
    region: 'BR',
    include_adult: 'false',
    include_video: 'false',
    sort_by: 'popularity.desc',
    'vote_count.gte': String(MIN_VOTE_COUNT),
    page: String(page),
  });
  const requiredGenreGroups: number[][] = [];

  const userGenres = unique((filters.genre ?? []).flatMap((name) => genreIdByName(name) ?? []));
  const moods = (filters.mood ?? []).map((mood) => MOOD_QUERIES[mood]);
  const moodGenres = sharedUnion(moods.map((mood) => mood.anyGenres));
  const moodKeywords = sharedUnion(moods.map((mood) => mood.anyKeywords));
  const withoutGenres = sharedIntersection(moods.map((mood) => mood.withoutGenres)).filter(
    (id) => !userGenres.includes(id),
  );

  if (userGenres.length > 0) {
    params.set('with_genres', userGenres.join('|'));
    if (moodGenres.length > 0) requiredGenreGroups.push(moodGenres);
  } else if (moodGenres.length > 0) {
    params.set('with_genres', moodGenres.join('|'));
  }
  if (withoutGenres.length > 0) params.set('without_genres', withoutGenres.join(','));

  const themeKeywords = unique((filters.theme ?? []).flatMap((theme) => THEME_KEYWORDS[theme]));
  const keywords = themeKeywords.length > 0 ? themeKeywords : moodKeywords;
  if (keywords.length > 0) params.set('with_keywords', keywords.join('|'));

  const durs = (filters.dur ?? []).map((dur) => DUR_RANGES[dur]);
  const minRuntime = lowestBound(durs.map((range) => range.min));
  const maxRuntime = highestBound(durs.map((range) => range.max));
  if (minRuntime !== null) params.set('with_runtime.gte', String(minRuntime));
  if (maxRuntime !== null) params.set('with_runtime.lte', String(maxRuntime));

  const decs = (filters.dec ?? []).map((dec) => DEC_RANGES[dec]);
  const fromYear = lowestBound(decs.map((range) => range.from));
  const toYear = highestBound(decs.map((range) => range.to));
  if (fromYear !== null) params.set('primary_release_date.gte', `${fromYear}-01-01`);
  if (toYear !== null) params.set('primary_release_date.lte', `${toYear}-12-31`);

  const providers = unique((filters.svc ?? []).flatMap((name) => streamingServiceByName(name)?.id ?? []));
  if (providers.length > 0) {
    params.set('with_watch_providers', providers.join('|'));
    params.set('watch_region', 'BR');
    params.set('with_watch_monetization_types', 'flatrate');
  }

  return { params, requiredGenreGroups, runtimeRange: { min: minRuntime, max: maxRuntime } };
}

/**
 * Junta as listas de todos os itens, mas só se todos tiverem uma; senão nenhum restringe.
 *
 * @param lists - Uma lista (ou nada) por item.
 * @returns A união sem repetidos, ou vazia.
 */
function sharedUnion(lists: (readonly number[] | undefined)[]): number[] {
  if (lists.length === 0 || lists.some((list) => !list || list.length === 0)) return [];
  return unique(lists.flatMap((list) => list ?? []));
}

/**
 * Valores presentes nas listas de todos os itens.
 *
 * @param lists - Uma lista (ou nada) por item.
 * @returns A interseção, ou vazia se algum item não tiver lista.
 */
function sharedIntersection(lists: (readonly number[] | undefined)[]): number[] {
  const [first, ...rest] = lists;
  if (!first) return [];
  return first.filter((value) => rest.every((list) => list?.includes(value)));
}

/**
 * Menor limite inferior de várias faixas; uma faixa aberta deixa o resultado aberto.
 *
 * @param bounds - Limites inferiores (null é aberto).
 * @returns O menor, ou null se não houver faixa ou alguma for aberta.
 */
function lowestBound(bounds: (number | null)[]): number | null {
  if (bounds.length === 0 || bounds.includes(null)) return null;
  return Math.min(...bounds.filter((bound): bound is number => bound !== null));
}

/**
 * Maior limite superior de várias faixas; uma faixa aberta deixa o resultado aberto.
 *
 * @param bounds - Limites superiores (null é aberto).
 * @returns O maior, ou null se não houver faixa ou alguma for aberta.
 */
function highestBound(bounds: (number | null)[]): number | null {
  if (bounds.length === 0 || bounds.includes(null)) return null;
  return Math.max(...bounds.filter((bound): bound is number => bound !== null));
}

/**
 * Tira os repetidos mantendo a ordem.
 *
 * @param values - Valores.
 * @returns Os valores sem repetição.
 */
function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
