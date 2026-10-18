import { formatDayMonth } from '../../notify/portuguese-text.js';
import type { Anniversary } from '../day-math.js';

/**
 * Anos por extenso: "1 ano", "30 anos".
 *
 * @param years - Anos.
 * @returns O texto.
 */
export function yearsText(years: number): string {
  return years === 1 ? '1 ano' : `${years} anos`;
}

/**
 * Quando cai o aniversário, visto de hoje: "hoje", "amanhã", "ontem" ou "em 22/10".
 *
 * @param anniversary - Aniversário mais próximo.
 * @returns O texto.
 */
export function whenText({ gap, day }: Anniversary): string {
  if (gap === 0) return 'hoje';
  if (gap === 1) return 'amanhã';
  if (gap === -1) return 'ontem';
  return `em ${formatDayMonth(day)}`;
}
