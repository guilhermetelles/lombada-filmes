/** Pedaços de texto em português usados nos itens da Atividade e nas notificações. */

/** Nomes dos meses, para "Retrospectiva de outubro". */
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
] as const;

/** Número no formato brasileiro, com até uma casa decimal. */
const DECIMAL = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** Número inteiro no formato brasileiro (1.234). */
const INTEGER = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/**
 * Junta itens como numa frase: "A", "A e B", "A, B e C".
 *
 * @param items - Itens, na ordem.
 * @returns A frase.
 */
export function joinPt(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;
}

/**
 * Escreve uma quantidade com a palavra no singular ou no plural: "1 filme", "3 filmes".
 *
 * @param count - Quantidade.
 * @param singular - Palavra no singular.
 * @param plural - Palavra no plural.
 * @returns A quantidade com a palavra.
 */
export function plural(count: number, singular: string, plural: string): string {
  return `${INTEGER.format(count)} ${count === 1 ? singular : plural}`;
}

/**
 * Formata um dia AAAA-MM-DD como DD/MM/AAAA.
 *
 * @param day - Dia AAAA-MM-DD.
 * @returns O dia no formato brasileiro.
 */
export function formatDay(day: string): string {
  return `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
}

/**
 * Formata um dia AAAA-MM-DD como DD/MM, sem o ano.
 *
 * @param day - Dia AAAA-MM-DD.
 * @returns Dia e mês.
 */
export function formatDayMonth(day: string): string {
  return `${day.slice(8, 10)}/${day.slice(5, 7)}`;
}

/**
 * Nome do mês por extenso.
 *
 * @param month - Mês AAAA-MM.
 * @returns O nome do mês, em minúsculas ("outubro").
 */
export function monthName(month: string): string {
  return MONTH_NAMES[Number(month.slice(5, 7)) - 1] ?? month;
}

/**
 * Formata minutos de filme como horas: "1 hora", "37 horas", "2,5 horas" abaixo de 10.
 *
 * @param minutes - Minutos.
 * @returns As horas por extenso.
 */
export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  const value = hours < 10 ? Math.round(hours * 10) / 10 : Math.round(hours);
  return `${DECIMAL.format(value)} ${value === 1 ? 'hora' : 'horas'}`;
}

/**
 * Formata um valor em dólares: "US$ 70 milhões", "US$ 1,2 bilhão", "US$ 850 mil".
 *
 * @param dollars - Valor em US$.
 * @returns O valor por extenso.
 */
export function formatDollars(dollars: number): string {
  if (dollars >= 1e9) {
    const value = Math.round(dollars / 1e8) / 10;
    return `US$ ${DECIMAL.format(value)} ${value < 2 ? 'bilhão' : 'bilhões'}`;
  }
  if (dollars >= 1e6) {
    const value = Math.round(dollars / 1e5) / 10;
    return `US$ ${DECIMAL.format(value)} ${value < 2 ? 'milhão' : 'milhões'}`;
  }
  if (dollars >= 1e3) return `US$ ${INTEGER.format(Math.round(dollars / 1e3))} mil`;
  return `US$ ${INTEGER.format(dollars)}`;
}

/**
 * Põe a primeira letra em maiúscula.
 *
 * @param text - Texto.
 * @returns O texto com a primeira letra maiúscula.
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
