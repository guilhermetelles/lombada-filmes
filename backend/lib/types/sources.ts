// Fontes externas de dados de filmes e o que cada uma devolve, já no formato do app.
// Quando a fonte não tem o filme, as notas vêm null: é uma resposta válida, que também vale 7 dias.

export type SourceName = 'tmdb' | 'omdb' | 'letterboxd';

export type Fetch = typeof globalThis.fetch;

export type Synopsis = { pt: string | null; en: string | null };

export type TmdbMovie = {
  title: string; // em inglês, como no Letterboxd e na lista original
  year: number | null;
  directors: string[];
  runtime: number | null; // minutos
  genres: string[]; // em português
  synopsis: Synopsis;
  posterPath: string | null;
  imdbId: string | null;
};

export type TmdbSearchResult = {
  tmdbId: number;
  title: string; // em português quando o TMDb tem tradução
  originalTitle: string | null;
  year: number | null;
  posterPath: string | null;
  overview: string | null; // trecho de até 200 caracteres
};

export type OmdbRatings = {
  imdb: { value: number | null; votes: number | null };
  rottenTomatoes: { value: number | null; url: string | null };
  metacritic: { value: number | null };
};

export type LetterboxdRating = {
  value: number | null; // média de 0,5 a 5; null quando o filme ainda tem poucas notas
  count: number | null;
  url: string | null; // página do filme; null quando o Letterboxd não tem o filme
};

export type TmdbClient = {
  getMovie(tmdbId: number): Promise<TmdbMovie>;
  search(query: string): Promise<TmdbSearchResult[]>;
};

export type OmdbClient = {
  getRatings(imdbId: string): Promise<OmdbRatings>;
};

export type LetterboxdClient = {
  getRating(tmdbId: number): Promise<LetterboxdRating>;
};

export type SourceClients = {
  tmdb: TmdbClient;
  omdb: OmdbClient;
  letterboxd: LetterboxdClient;
};
