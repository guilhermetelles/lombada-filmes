import * as z from 'zod';
import { EnvSchema } from '../schemas/env.js';
import type { Env } from '../types/env.js';

/**
 * Lê e valida as variáveis de ambiente de uma vez, para que a falta de uma chave apareça na
 * primeira chamada, com o nome da variável, e não no meio de um pedido a uma fonte.
 *
 * @returns As variáveis validadas, com GCLOUD_PROJECT preenchido por padrão.
 * @throws {Error} Se faltar uma variável obrigatória ou alguma estiver vazia.
 */
function readEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`variáveis de ambiente inválidas:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export { readEnv };
