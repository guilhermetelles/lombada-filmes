import { genreIdByName } from '../discover/discover-vocabulary.js';
import { candidateFeatures } from '../discover/score-candidates.js';
import type { DiscoverCandidate } from '../discover/tmdb-discover-client.js';
import type { Movie } from '../types/movie.js';

/** Peso de cada tipo de marca na semelhança entre dois filmes (vizinhos e variedade). */
const TAG_WEIGHTS = { director: 3, collection: 3, keyword: 1, genre: 1, decade: 0.5 } as const;

/**
 * Variáveis do modelo para um filme guardado em movies/{tmdbId}, com os mesmos nomes e as mesmas
 * contas de candidateFeatures (a busca avançada lê o modelo gravado): `genre:<pt-BR>`,
 * `decade:<ano>`, `vote`, `votesLog`, `popularityLog` e `keyword:<nome>`. Só usa campos do TMDb.
 *
 * @param movie - Documento do filme.
 * @returns Valor de cada variável.
 */
export function movieFeatures(movie: Movie): Record<string, number> {
  return candidateFeatures(asCandidate(movie), {
    runtime: movie.runtime,
    providers: [],
    keywords: movie.keywords ?? [],
  });
}

/**
 * Converte um filme guardado no formato de um filme do /discover, para reaproveitar as contas da
 * busca avançada.
 *
 * @param movie - Documento do filme.
 * @param tmdbId - Id do filme no TMDb (0 quando não importa).
 * @returns O filme como candidato do /discover.
 */
export function asCandidate(movie: Movie, tmdbId = 0): DiscoverCandidate {
  return {
    tmdbId,
    title: movie.titlePt ?? movie.title,
    year: movie.year,
    posterPath: movie.posterPath,
    genreIds: movie.genres.flatMap((genre) => genreIdByName(genre) ?? []),
    vote: movie.vote ?? null,
    votes: movie.votes ?? 0,
    popularity: movie.popularity ?? 0,
  };
}

/**
 * Marcas de um filme para medir semelhança: diretores, saga, palavras-chave, gêneros e década, cada
 * uma com o seu peso (diretor e saga pesam mais que um gênero).
 *
 * @param movie - Documento do filme.
 * @returns Peso de cada marca, como `director:2710` ou `keyword:time travel`.
 */
export function similarityTags(movie: Movie): Map<string, number> {
  const tags = new Map<string, number>();
  for (const director of movie.directors) tags.set(`director:${director.id}`, TAG_WEIGHTS.director);
  if (movie.collection) tags.set(`collection:${movie.collection.id}`, TAG_WEIGHTS.collection);
  for (const keyword of movie.keywords ?? []) tags.set(`keyword:${keyword}`, TAG_WEIGHTS.keyword);
  for (const genre of movie.genres) tags.set(`genre:${genre}`, TAG_WEIGHTS.genre);
  if (movie.year !== null) tags.set(`decade:${Math.floor(movie.year / 10) * 10}`, TAG_WEIGHTS.decade);
  return tags;
}

/**
 * Semelhança de Jaccard ponderada entre dois conjuntos de marcas: soma dos pesos em comum dividida
 * pela soma dos pesos de todas as marcas dos dois.
 *
 * @param a - Marcas de um filme.
 * @param b - Marcas do outro.
 * @returns De 0 (nada em comum) a 1 (as mesmas marcas).
 */
export function tagSimilarity(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): number {
  let shared = 0;
  let total = 0;
  for (const [tag, weight] of a) {
    total += weight;
    if (b.has(tag)) shared += weight;
  }
  for (const [tag, weight] of b) if (!a.has(tag)) total += weight;
  return total === 0 ? 0 : shared / total;
}
