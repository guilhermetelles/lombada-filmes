/** Fuso de Brasília, que define "hoje" e "este mês" em todo o backend (e no app). */
export const BRAZIL_TIME_ZONE = 'America/Sao_Paulo';

/** Formata a data no fuso de Brasília como AAAA-MM-DD (o en-CA usa esse formato). */
const BRAZIL_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: BRAZIL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Diz em que dia, no fuso de Brasília, um momento cai.
 *
 * @param now - Momento a converter.
 * @returns O dia como AAAA-MM-DD.
 */
export function brazilDay(now: Date): string {
  return BRAZIL_DATE.format(now);
}

/**
 * Diz em que mês, no fuso de Brasília, um momento cai.
 *
 * @param now - Momento a converter.
 * @returns O mês como AAAA-MM.
 */
export function brazilMonth(now: Date): string {
  return brazilDay(now).slice(0, 7);
}

/**
 * Devolve o mês anterior a um mês.
 *
 * @param month - Mês como AAAA-MM.
 * @returns O mês anterior como AAAA-MM (janeiro volta para dezembro do ano anterior).
 * @throws {Error} Se o mês não estiver no formato AAAA-MM.
 */
export function previousMonth(month: string): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) throw new Error(`mês inválido: ${month}`);
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber === 1) return `${String(year - 1).padStart(4, '0')}-12`;
  return `${match[1]}-${String(monthNumber - 1).padStart(2, '0')}`;
}

/**
 * Diz se o momento cai no dia 1 do mês, no fuso de Brasília (quando a rotina fecha o mês anterior).
 *
 * @param now - Momento a conferir.
 * @returns true no dia 1.
 */
export function isFirstDayOfMonth(now: Date): boolean {
  return brazilDay(now).endsWith('-01');
}
