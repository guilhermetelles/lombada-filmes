import type * as z from 'zod';
import { toGeminiJsonSchema } from '../gemini/gemini-json-schema.js';

/** Palavras do JSON Schema que o modo strict da Groq não aceita (limites e valor padrão). */
const UNSUPPORTED_KEYS = new Set(['default', 'maxItems', 'minItems', 'exclusiveMinimum', 'maximum', 'minimum']);

/**
 * Converte o schema zod da resposta no JSON Schema do modo strict da Groq: todo campo entra em
 * `required`, os opcionais passam a aceitar null, todo objeto fecha com `additionalProperties:
 * false` e saem os limites que o modo strict não aceita (a validação com zod continua com eles).
 *
 * @param schema - Formato da resposta, o mesmo que valida o que volta.
 * @returns O JSON Schema no formato strict.
 */
function toGroqJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return toStrict(toGeminiJsonSchema(schema)) as Record<string, unknown>;
}

/**
 * Aplica as regras do modo strict num nó do JSON Schema e nos filhos.
 *
 * @param node - Nó do JSON Schema.
 * @returns O nó convertido.
 */
function toStrict(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toStrict);
  if (typeof node !== 'object' || node === null) return node;
  const converted: Record<string, unknown> = Object.fromEntries(
    Object.entries(node).flatMap(([key, value]) => (UNSUPPORTED_KEYS.has(key) ? [] : [[key, toStrict(value)]])),
  );
  if (converted.type === 'object' && typeof converted.properties === 'object' && converted.properties !== null) {
    const required = new Set(Array.isArray(converted.required) ? converted.required : []);
    const properties = converted.properties as Record<string, Record<string, unknown>>;
    for (const [key, property] of Object.entries(properties)) {
      // Opcional no zod vira "pode ser null": o modo strict exige todos os campos na resposta.
      if (!required.has(key) && typeof property.type === 'string')
        properties[key] = { ...property, type: [property.type, 'null'] };
    }
    converted.required = Object.keys(properties);
    converted.additionalProperties = false;
  }
  return converted;
}

export { toGroqJsonSchema };
