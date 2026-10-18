import * as z from 'zod';
import type { Env, ServiceAccount } from '../types/env.js';

/** Variáveis de ambiente do backend. A conta de serviço só é obrigatória fora dos emuladores. */
export const EnvSchema: z.ZodType<Env> = z
  .object({
    TMDB_TOKEN: z.string().min(1),
    CRON_SECRET: z.string().min(16, 'deve ter pelo menos 16 caracteres'),
    OMDB_KEY: z.string().min(1),
    GEMINI_API_KEY: z.string().min(1).optional(),
    FIREBASE_SERVICE_ACCOUNT: z.string().min(1).optional(),
    FIRESTORE_EMULATOR_HOST: z.string().min(1).optional(),
    GCLOUD_PROJECT: z.string().min(1).default('demo-lombada'),
  })
  .refine((env) => env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_SERVICE_ACCOUNT, {
    message: 'obrigatória fora dos emuladores',
    path: ['FIREBASE_SERVICE_ACCOUNT'],
  });

/** Campos da conta de serviço que o Admin SDK usa (o resto do JSON é ignorado). */
export const ServiceAccountSchema: z.ZodType<ServiceAccount> = z.object({
  project_id: z.string().min(1),
  client_email: z.string().min(1),
  private_key: z.string().min(1),
});
