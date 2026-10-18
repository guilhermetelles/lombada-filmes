import * as z from 'zod';

/** JSON Schema no subconjunto que a saída estruturada do Gemini aceita. */
type JsonSchema = Record<string, unknown>;

/**
 * Converte o schema zod da resposta no JSON Schema pedido ao Gemini em `response_format.schema`.
 * Tira o `$schema`, que não faz parte do subconjunto aceito pela saída estruturada.
 *
 * @param schema - Formato da resposta, o mesmo que valida o que volta.
 * @returns O JSON Schema equivalente.
 */
function toGeminiJsonSchema(schema: z.ZodType): JsonSchema {
  const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema, { io: 'output', unrepresentable: 'any' });
  return jsonSchema;
}

export { toGeminiJsonSchema };
