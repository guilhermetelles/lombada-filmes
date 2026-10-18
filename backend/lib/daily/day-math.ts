import { DAY_MS } from '../time/durations.js';

/** Contas com dias AAAA-MM-DD (do fuso de Brasília), feitas em UTC para não depender do fuso da máquina. */

/**
 * Converte um dia AAAA-MM-DD no instante da meia-noite UTC desse dia.
 *
 * @param day - Dia AAAA-MM-DD.
 * @returns Milissegundos desde 1970.
 */
function dayToUtc(day: string): number {
  return Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
}

/**
 * Quantos dias vão de um dia a outro.
 *
 * @param from - Dia inicial, AAAA-MM-DD.
 * @param to - Dia final, AAAA-MM-DD.
 * @returns A diferença em dias (negativa se `to` vier antes).
 */
export function daysBetween(from: string, to: string): number {
  return Math.round((dayToUtc(to) - dayToUtc(from)) / DAY_MS);
}

/**
 * Soma dias a um dia.
 *
 * @param day - Dia AAAA-MM-DD.
 * @param days - Dias a somar (negativo volta).
 * @returns O dia resultante, AAAA-MM-DD.
 */
export function addDays(day: string, days: number): string {
  return new Date(dayToUtc(day) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Aniversário mais próximo de uma data: quantos dias faltam (negativo se já passou) e o dia dele. */
export type Anniversary = { gap: number; day: string; years: number };

/**
 * Acha o aniversário (mesmo dia e mês) mais próximo de hoje, olhando o ano passado, este e o
 * próximo. 29 de fevereiro cai em 1º de março nos anos que não são bissextos.
 *
 * @param date - Data original, AAAA-MM-DD.
 * @param today - Hoje, AAAA-MM-DD.
 * @returns Dias até o aniversário (com sinal), o dia dele e quantos anos ele completa.
 */
export function nearestAnniversary(date: string, today: string): Anniversary {
  const year = Number(today.slice(0, 4));
  const month = Number(date.slice(5, 7)) - 1;
  const dayOfMonth = Number(date.slice(8, 10));
  const candidates = [year - 1, year, year + 1].map((candidateYear) => {
    const day = new Date(Date.UTC(candidateYear, month, dayOfMonth)).toISOString().slice(0, 10);
    return { gap: daysBetween(today, day), day, years: candidateYear - Number(date.slice(0, 4)) };
  });
  return candidates.reduce((best, candidate) => (Math.abs(candidate.gap) < Math.abs(best.gap) ? candidate : best));
}

/**
 * Diz se o texto é um dia AAAA-MM-DD.
 *
 * @param value - Valor lido do banco.
 * @returns true para AAAA-MM-DD.
 */
export function isDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
