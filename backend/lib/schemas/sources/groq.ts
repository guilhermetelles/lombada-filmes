import * as z from 'zod';

/** Resposta de /openai/v1/chat/completions da Groq: só o texto da primeira escolha. */
export const GroqChatCompletionSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().nullable() }), finish_reason: z.string().nullable() }))
    .min(1),
});

/** Corpo de erro da Groq (formato da OpenAI). */
export const GroqErrorBodySchema = z.object({
  error: z.object({ message: z.string().optional() }),
});
