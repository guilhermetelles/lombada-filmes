import { pick, type Random } from './seeded-random.js';

/** Nomes dos meses em português, para "outubro de 2026". */
const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** O que entra no lugar de cada palavra do título num trecho de comentário. */
export const TITLE_MASK = '▇▇▇';

/** Palavras curtas e comuns que não entregam o título e ficam no trecho. */
const STOP_WORDS = new Set([
  'the',
  'and',
  'with',
  'from',
  'into',
  'that',
  'this',
  'para',
  'como',
  'pelo',
  'pela',
  'uma',
  'dos',
  'das',
]);

/** Tamanho mínimo e máximo do trecho de comentário, em caracteres. */
export const EXCERPT_LIMITS = { min: 40, max: 200 } as const;

/**
 * Monta o rótulo de um filme nas alternativas: título e ano.
 *
 * @param movie - Título e ano.
 * @returns "The Abyss (1989)", ou só o título sem ano.
 */
export function movieLabel({ title, year }: { title: string; year: number | null }): string {
  return year ? `${title} (${year})` : title;
}

/**
 * Escreve um mês por extenso.
 *
 * @param month - Mês como AAAA-MM.
 * @returns "outubro de 2026".
 */
export function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-');
  return `${MONTH_NAMES[Number(monthNumber) - 1] ?? monthNumber} de ${year}`;
}

/**
 * Soma meses a um mês.
 *
 * @param month - Mês como AAAA-MM.
 * @param offset - Quantos meses somar (negativo volta).
 * @returns O mês resultante, como AAAA-MM.
 */
export function addMonths(month: string, offset: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const total = (year ?? 0) * 12 + (monthNumber ?? 1) - 1 + offset;
  return `${String(Math.floor(total / 12)).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/**
 * Escreve um dia no formato brasileiro.
 *
 * @param day - Dia como AAAA-MM-DD.
 * @returns "18/10/2026".
 */
export function formatDay(day: string): string {
  return day.split('-').reverse().join('/');
}

/**
 * Escreve um valor em dólares por extenso e arredondado, como no mock.
 *
 * @param amount - Valor em US$.
 * @returns "US$ 70 milhões", "US$ 1,2 bilhão" ou "US$ 800 mil".
 */
export function formatMoney(amount: number): string {
  if (amount >= 1e9) {
    const billions = (amount / 1e9).toFixed(1).replace('.', ',');
    return `US$ ${billions} ${amount >= 2e9 ? 'bilhões' : 'bilhão'}`;
  }
  if (amount >= 1e6) return `US$ ${Math.round(amount / 1e6)} milhões`;
  return `US$ ${Math.round(amount / 1e3)} mil`;
}

/**
 * Junta itens em português: "a", "a e b", "a, b e c".
 *
 * @param items - Itens.
 * @returns O texto.
 */
export function joinPt(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;
}

/**
 * Esconde com ▇▇▇ as palavras dos títulos (original e em português) que aparecem no texto, inclusive
 * com até 3 letras a mais (plural, gênero). Palavras com menos de 4 letras e as comuns ficam.
 *
 * @param text - Trecho verbatim do comentário.
 * @param titles - Títulos do filme.
 * @returns O trecho com as palavras do título escondidas.
 */
export function maskTitleWords(text: string, titles: readonly string[]): string {
  const words = new Set<string>();
  for (const title of titles) {
    for (const word of title.split(/[^\p{L}\p{N}']+/u)) {
      const clean = word.replace(/'s$/i, '');
      if (clean.length >= 4 && !STOP_WORDS.has(clean.toLowerCase())) words.add(clean);
    }
  }
  let masked = text;
  for (const word of words) {
    const safe = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    masked = masked.replace(new RegExp(`(^|[^\\p{L}])(${safe}\\p{L}{0,3})(?=$|[^\\p{L}])`, 'giu'), `$1${TITLE_MASK}`);
  }
  return masked;
}

/**
 * Escolhe por regra simples um trecho do comentário, sem reescrever nada: uma ou duas frases
 * seguidas dentro dos limites de tamanho. É o recurso quando o Gemini falha.
 *
 * @param comment - Comentário verbatim.
 * @param random - Gerador com semente.
 * @returns O trecho, ou undefined se nenhuma frase couber nos limites.
 */
export function pickSentenceExcerpt(comment: string, random: Random): string | undefined {
  const sentences = comment
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const fits = (text: string) => text.length >= EXCERPT_LIMITS.min && text.length <= EXCERPT_LIMITS.max;
  const candidates: string[] = [];
  sentences.forEach((sentence, index) => {
    if (fits(sentence)) candidates.push(sentence);
    const next = sentences[index + 1];
    // Duas frases só valem se aparecerem assim no original (separadas por um espaço).
    if (next && fits(`${sentence} ${next}`) && comment.includes(`${sentence} ${next}`)) {
      candidates.push(`${sentence} ${next}`);
    }
  });
  return pick(candidates, random);
}
