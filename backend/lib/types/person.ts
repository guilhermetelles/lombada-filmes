/** Pessoas do TMDb (quem dirige e quem atua nos filmes) e o documento people/{tmdbPersonId}. */

/** Referência a uma pessoa dentro de um filme: id de pessoa do TMDb e nome. */
export type PersonRef = {
  id: number;
  name: string;
};

/** Pessoa do elenco de um filme, na ordem dos créditos. */
export type CastMember = {
  id: number;
  name: string;
  character: string | null; // personagem; null quando o TMDb não informa
  profilePath: string | null; // foto: image.tmdb.org/t/p/w185{profilePath}; sem foto, o app mostra iniciais
};

/** Filme em que a pessoa atuou, como aparece na tela do ator. */
export type ActedMovie = {
  tmdbId: number;
  title: string; // em inglês, como os títulos dos filmes no app
  year: number | null;
  character: string | null;
};

/** Filme dirigido pela pessoa, como aparece na tela do diretor. */
export type DirectedMovie = {
  tmdbId: number;
  title: string; // em inglês, como os títulos dos filmes no app
  year: number | null;
};

/** Área pela qual a pessoa é conhecida, entre as que a busca devolve. */
export type PersonDepartment = 'acting' | 'directing';

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
  actedCount: number; // filmes em que atuou, sem repetição e sem imagens de arquivo
  acted: ActedMovie[]; // os mais votados, até 20; o app cruza com a lista
  fetchedAt: Date;
};
