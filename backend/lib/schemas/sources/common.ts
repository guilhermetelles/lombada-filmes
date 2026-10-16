import * as z from 'zod';

/** Texto opcional de uma fonte: ausente, null, vazio ou só espaços vira null. */
export const optionalText = z
  .string()
  .nullish()
  .transform((text) => text?.trim() || null);
