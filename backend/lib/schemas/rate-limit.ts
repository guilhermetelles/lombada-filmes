import * as z from 'zod';

/** rateLimits/{uid}_{dia}: quantos pedidos limitados a pessoa fez no dia (só o backend lê e grava). */
export const RateLimitDocSchema = z.object({
  uid: z.string(),
  day: z.string(),
  interpret: z.number().int().nonnegative().default(0),
});
