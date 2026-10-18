/** O que entra no lugar de cada nome tirado do texto. */
export const NAME_PLACEHOLDER = '[nome]';

/** Nomes com menos letras que isso ficam de fora, para não apagar pedaços de palavras comuns. */
const MIN_NAME_LENGTH = 2;

/**
 * Tira nomes conhecidos (membros da lista, apelidos) de um texto da dupla antes de mandá-lo ao
 * Gemini, trocando cada ocorrência por "[nome]". A comparação ignora maiúsculas e acentos e só
 * casa a palavra inteira ("Ana" sai de "a Ana viu", mas fica em "banana"). Nomes compostos saem
 * inteiros, e também cada parte deles ("Maria Clara" tira "Maria Clara", "Maria" e "Clara").
 *
 * @param text - Texto a enviar, como um comentário da lista.
 * @param names - Nomes conhecidos; vazios e repetidos são ignorados.
 * @returns O texto sem os nomes.
 */
function scrubNames(text: string, names: readonly string[]): string {
  const terms = new Set<string>();
  for (const name of names) {
    const whole = foldForMatch(name.trim());
    if (whole.length >= MIN_NAME_LENGTH) terms.add(whole);
    for (const part of whole.split(/\s+/)) if (part.length >= MIN_NAME_LENGTH) terms.add(part);
  }
  if (terms.size === 0) return text;

  // Os mais longos primeiro, para "Maria Clara" sair inteiro antes de "Maria".
  const alternatives = [...terms].sort((a, b) => b.length - a.length).map(escapeRegExp);
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join('|')})(?![\\p{L}\\p{N}])`, 'gu');

  // A busca roda numa cópia sem acentos e com o mesmo tamanho; as posições valem no original.
  const folded = foldForMatch(text);
  let result = '';
  let last = 0;
  for (const match of folded.matchAll(pattern)) {
    result += text.slice(last, match.index) + NAME_PLACEHOLDER;
    last = match.index + match[0].length;
  }
  return result + text.slice(last);
}

/**
 * Passa para minúsculas e tira acentos letra a letra, mantendo o tamanho do texto (cada caractere
 * vira exatamente um), para as posições achadas na cópia valerem no texto original.
 *
 * @param text - Texto original.
 * @returns A cópia para comparação, com o mesmo número de unidades.
 */
function foldForMatch(text: string): string {
  let folded = '';
  for (const char of text) {
    const base = char.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    folded += base.length === char.length ? base : char;
  }
  return folded;
}

/**
 * Escapa um texto para usá-lo literalmente numa expressão regular.
 *
 * @param text - Texto literal.
 * @returns O texto com os caracteres especiais escapados.
 */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export { scrubNames };
