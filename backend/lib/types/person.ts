// Pessoas do TMDb (por ora, quem dirige os filmes) e o documento people/{tmdbPersonId}.

/** Referência a uma pessoa dentro de um filme: id de pessoa do TMDb e nome. */
export type PersonRef = {
  id: number;
  name: string;
};

/** Filme dirigido pela pessoa, como aparece na tela do diretor. */
export type DirectedMovie = {
  tmdbId: number;
  title: string; // em inglês, como os títulos dos filmes no app
  year: number | null;
};

/** Idioma da biografia guardada. */
export type BiographyLanguage = 'pt' | 'en';

/** Documento people/{tmdbPersonId}. */
export type Person = {
  name: string;
  birthday: string | null; // AAAA-MM-DD
  deathday: string | null; // AAAA-MM-DD
  placeOfBirth: string | null;
  biography: string | null;
  bioLang: BiographyLanguage | null; // null quando não há biografia
  profilePath: string | null; // foto: image.tmdb.org/t/p/w185{profilePath}
  imdbId: string | null;
  directedCount: number; // filmes dirigidos, sem repetição
  directed: DirectedMovie[]; // os mais populares, até 12; o app tira os que já estão na lista
  fetchedAt: Date;
};
