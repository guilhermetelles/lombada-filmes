import * as z from 'zod';

/** Dia no fuso de Brasília, como id de quizzes/{dia} e notifyLog: AAAA-MM-DD. */
export const BrazilDaySchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'dia deve ser AAAA-MM-DD');

/** Mês no fuso de Brasília, como id de scores/{mês} e retros/{mês}: AAAA-MM. */
export const BrazilMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'mês deve ser AAAA-MM');
