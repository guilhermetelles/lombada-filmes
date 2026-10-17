/** Artigo que o site põe no fim do título ("Abyss, The"); o grupo 1 é o título, o 2 o artigo. */
const TRAILING_ARTICLE = /^(.*), (The|A|An)$/;
/** Marcas de acento que sobram depois da decomposição NFKD. */
const COMBINING_MARKS = /\p{M}/gu;
/** Tudo o que não é letra ou número, depois de tirar os acentos. */
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;

/**
 * Normaliza um título para comparar o do TMDb com o do bechdeltest.com: o artigo do fim (", The",
 * ", A", ", An") volta para o começo, os acentos saem, "&" vira "and", tudo em minúsculas e só
 * letras e números, separados por um espaço.
 *
 * @param title - Título em qualquer dos dois formatos, como "Abyss, The" ou "The Abyss".
 * @returns O título normalizado, como "the abyss".
 */
function normalizeTitle(title: string): string {
  return title
    .trim()
    .replace(TRAILING_ARTICLE, '$2 $1')
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replaceAll('&', 'and')
    .replace(NON_ALPHANUMERIC, ' ')
    .trim();
}

export { normalizeTitle };
