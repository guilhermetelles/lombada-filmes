import type { Movie } from '../../lib/types/movie.js';

/** Filmes sintéticos para os testes do motor de sugestões (nada vem de dados reais da dupla). */

/** Gêneros usados nos filmes sintéticos (nomes do TMDb em pt-BR). */
const GENRES = ['Terror', 'Comédia', 'Drama', 'Ação', 'Ficção científica', 'Romance', 'Thriller', 'Animação'];

/** Palavras-chave usadas nos filmes sintéticos. */
const KEYWORDS = Array.from({ length: 40 }, (_, index) => `tema ${index + 1}`);

/**
 * Gerador pseudoaleatório com semente (mulberry32), para os testes darem sempre o mesmo resultado.
 *
 * @param seed - Semente.
 * @returns Função que devolve números de 0 a 1.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Monta um documento de filme completo com o mínimo informado.
 *
 * @param overrides - Campos a trocar.
 * @returns O filme.
 */
export function makeMovie(overrides: Partial<Movie> = {}): Movie {
  return {
    title: 'Filme sintético',
    year: 2000,
    directors: [],
    cast: [],
    runtime: 100,
    genres: [],
    synopsis: { pt: null, en: null },
    posterPath: null,
    ids: { imdb: null, letterboxd: null },
    ratings: {},
    tmdbFetchedAt: new Date('2026-10-01T00:00:00Z'),
    keywords: [],
    recs: [],
    collection: null,
    popularity: 10,
    vote: 6.5,
    votes: 1000,
    ...overrides,
  };
}

/** Um filme sintético e a utilidade escondida dele para a dupla. */
export type SyntheticMovie = { tmdbId: number; movie: Movie; utility: number };

/**
 * Gera um catálogo sintético: cada filme com 1 a 3 gêneros, até 6 palavras-chave, década, nota e
 * popularidade aleatórias, e uma utilidade escondida (o gosto da dupla) que depende de alguns
 * gêneros e palavras-chave, com ruído. A nota do TMDb tem só uma ligação fraca com essa utilidade.
 *
 * @param size - Quantos filmes.
 * @param seed - Semente.
 * @returns O catálogo.
 */
export function syntheticCatalog(size: number, seed: number): SyntheticMovie[] {
  const random = seededRandom(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
  // Gosto escondido: adora Terror e "tema 1" a "tema 5", não gosta de Romance nem de "tema 6" a "tema 10".
  const taste = (genres: string[], keywords: string[]) =>
    (genres.includes('Terror') ? 1.5 : 0) +
    (genres.includes('Comédia') ? 0.6 : 0) -
    (genres.includes('Romance') ? 1.2 : 0) +
    keywords.reduce((sum, keyword) => {
      const number = Number(keyword.split(' ')[1]);
      return sum + (number <= 5 ? 0.8 : number <= 10 ? -0.7 : 0);
    }, 0);

  return Array.from({ length: size }, (_, index) => {
    const genres = [...new Set(Array.from({ length: 1 + Math.floor(random() * 3) }, () => pick(GENRES)))];
    const keywords = [...new Set(Array.from({ length: Math.floor(random() * 7) }, () => pick(KEYWORDS)))];
    const utility = taste(genres, keywords) + (random() - 0.5) * 1.5;
    const vote = Math.min(9, Math.max(3, 6.2 + 0.25 * utility + (random() - 0.5) * 3));
    const movie = makeMovie({
      title: `Sintético ${index + 1}`,
      year: 1970 + Math.floor(random() * 55),
      genres,
      keywords,
      vote: Math.round(vote * 10) / 10,
      votes: Math.floor(100 + random() * 20000),
      popularity: Math.round(random() * 1000) / 10,
    });
    return { tmdbId: 1000 + index, movie, utility };
  });
}
