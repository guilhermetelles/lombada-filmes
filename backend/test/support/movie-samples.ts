import type { LetterboxdRating, OmdbRatings, TmdbMovie } from '../../lib/types/sources.js';

/** Respostas de exemplo das fontes, já no formato do app, para testar as regras de filmes. */

/** The Abyss como o cliente do TMDb devolve. */
export const tmdbAbyss: TmdbMovie = {
  title: 'The Abyss',
  year: 1989,
  directors: [{ id: 2710, name: 'James Cameron', profilePath: '/cameron.jpg' }],
  cast: [{ id: 228, name: 'Ed Harris', character: "Virgil 'Bud' Brigman", profilePath: '/harris.jpg' }],
  runtime: 138,
  genres: ['Aventura'],
  synopsis: { pt: 'Um submarino…', en: 'A civilian oil rig crew…' },
  posterPath: '/abyss.jpg',
  imdbId: 'tt0096754',
};

/** Nota do Letterboxd de The Abyss. */
export const letterboxdAbyss: LetterboxdRating = {
  value: 3.72,
  count: 174_000,
  url: 'https://letterboxd.com/film/the-abyss/',
};

/** Notas da OMDb de The Abyss. */
export const omdbAbyss: OmdbRatings = {
  imdb: { value: 7.5, votes: 211_000 },
  rottenTomatoes: { value: 75, url: 'https://www.rottentomatoes.com/m/abyss/' },
  metacritic: { value: 62 },
};
