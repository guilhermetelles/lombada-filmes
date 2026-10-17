import type { BechdelIndexEntry } from '../types/sources.js';
import { normalizeTitle } from './normalize-title.js';

/** Diferença máxima de ano entre o TMDb e o site (estreia em festival, lançamento em outro país). */
const MAX_YEAR_DIFFERENCE = 1;
/**
 * Diferença de ano aceita no último recurso, só para título igual: há filmes com anos de produção e
 * de lançamento distantes ("Cannibal! The Musical" é 1993 no site e 1996 no TMDb).
 */
const MAX_EXACT_YEAR_DIFFERENCE = 3;
/** Máximo de candidatos aproximados por filme: cada um custa uma página do site. */
const MAX_APPROXIMATE_CANDIDATES = 3;
/** Tamanho mínimo do título contido no outro, para "it" não casar com tudo. */
const MIN_CONTAINED_LENGTH = 4;
/** Números escritos por extenso, para "The Fantastic 4" casar com "Fantastic Four". */
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** Título e ano do filme a procurar no índice. */
type TitleQuery = { title: string; year: number | null };

/** Um filme do índice com o título normalizado e as diferenças para o filme procurado. */
type Candidate = { entry: BechdelIndexEntry; title: string; yearDifference: number; lengthDifference: number };

/**
 * Procura no índice do site os filmes que podem ser este, em três tentativas, cada uma só quando a
 * anterior não achou nada: título normalizado igual com até 1 ano de diferença; título parecido com
 * até 1 ano de diferença (um contido no outro, uma letra de diferença ou um número escrito por
 * extenso); título igual com até 3 anos de diferença. Os candidatos ainda precisam ser confirmados
 * pelo id do IMDb.
 *
 * @param index - Índice do bechdeltest.com.
 * @param query - Título e ano do filme (título em inglês, como o TMDb grava).
 * @returns Candidatos, dos mais próximos (ano, depois tamanho do título) aos mais distantes; vazio quando o filme não tem ano.
 */
function findCandidates(index: BechdelIndexEntry[], { title, year }: TitleQuery): BechdelIndexEntry[] {
  if (year === null) return [];
  const target = normalizeTitle(title);
  const nearby: Candidate[] = index
    .filter((entry) => Math.abs(entry.year - year) <= MAX_EXACT_YEAR_DIFFERENCE)
    .map((entry) => {
      const normalized = normalizeTitle(entry.title);
      return {
        entry,
        title: normalized,
        yearDifference: Math.abs(entry.year - year),
        lengthDifference: Math.abs(normalized.length - target.length),
      };
    })
    .sort((a, b) => a.yearDifference - b.yearDifference || a.lengthDifference - b.lengthDifference);
  const close = nearby.filter((candidate) => candidate.yearDifference <= MAX_YEAR_DIFFERENCE);

  const attempts = [
    close.filter((candidate) => candidate.title === target),
    close.filter((candidate) => areSimilar(target, candidate.title)).slice(0, MAX_APPROXIMATE_CANDIDATES),
    nearby.filter((candidate) => candidate.title === target),
  ];
  const found = attempts.find((candidates) => candidates.length > 0) ?? [];
  return found.map(({ entry }) => entry);
}

/**
 * Diz se dois títulos normalizados diferentes podem ser o mesmo filme.
 *
 * @param a - Um título normalizado.
 * @param b - O outro título normalizado.
 * @returns true se forem iguais com os números por extenso, se um contiver o outro (palavras
 * inteiras) ou se diferirem em uma letra.
 */
function areSimilar(a: string, b: string): boolean {
  return spellNumbers(a) === spellNumbers(b) || containsWords(a, b) || containsWords(b, a) || isOneEditApart(a, b);
}

/**
 * Troca os números de 0 a 10 escritos com algarismos pela palavra em inglês.
 *
 * @param title - Título normalizado.
 * @returns O título com os números por extenso.
 */
function spellNumbers(title: string): string {
  return title.replace(/\b\d+\b/g, (number) => NUMBER_WORDS[Number(number)] ?? number);
}

/**
 * Diz se um título contém o outro como palavras inteiras ("the twilight saga new moon" contém
 * "new moon").
 *
 * @param long - Título que pode conter o outro.
 * @param short - Título que pode estar contido.
 * @returns true se `short` aparecer em `long` entre espaços e tiver o tamanho mínimo.
 */
function containsWords(long: string, short: string): boolean {
  return short.length >= MIN_CONTAINED_LENGTH && ` ${long} `.includes(` ${short} `);
}

/**
 * Diz se dois textos diferem em exatamente uma letra: trocada, a mais ou a menos ("judgment" e
 * "judgement").
 *
 * @param a - Um texto.
 * @param b - O outro texto.
 * @returns true se a distância de edição for 1.
 */
function isOneEditApart(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  let i = 0;
  while (i < shorter.length && shorter[i] === longer[i]) i++;
  // Depois da primeira diferença, o resto tem de bater: trocando uma letra ou pulando a a mais.
  const skip = shorter.length === longer.length ? 1 : 0;
  return shorter.slice(i + skip) === longer.slice(i + 1);
}

export { findCandidates };
