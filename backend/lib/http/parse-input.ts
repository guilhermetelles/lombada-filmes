import type * as z from 'zod';
import { InvalidInputError } from '../errors/app-errors.js';

/**
 * Valida a entrada de um pedido (query, caminho ou corpo) contra um schema de lib/schemas/.
 *
 * @param schema - Schema da entrada; as mensagens dele vão para o app.
 * @param input - Valores lidos do pedido.
 * @returns A entrada validada e convertida pelo schema.
 * @throws {InvalidInputError} Se a entrada não passar no schema (a rota responde 400).
 */
function parseInput<Schema extends z.ZodType>(schema: Schema, input: unknown): z.output<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new InvalidInputError(result.error.issues.map((issue) => issue.message).join('; '));
  }
  return result.data;
}

export { parseInput };
