import type * as z from 'zod';
import { InvalidInputError } from '../errors/app-errors.js';
import { parseInput } from './parse-input.js';

/**
 * Lê o corpo JSON do pedido e valida contra um schema de lib/schemas/route-inputs.ts.
 *
 * @param request - Pedido recebido pela rota.
 * @param schema - Formato esperado do corpo.
 * @returns O corpo validado e convertido pelo schema.
 * @throws {InvalidInputError} Se o corpo não for JSON ou não passar no schema (a rota responde 400).
 */
async function readJsonBody<Schema extends z.ZodType>(request: Request, schema: Schema): Promise<z.output<Schema>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new InvalidInputError('o corpo do pedido deve ser JSON');
  }
  return parseInput(schema, body);
}

export { readJsonBody };
