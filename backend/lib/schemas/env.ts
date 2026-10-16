import * as z from 'zod';
import type { Env, ServiceAccount } from '../types/env.js';

export const EnvSchema: z.ZodType<Env> = z
  .object({
    TMDB_TOKEN: z.string().min(1),
    OMDB_KEY: z.string().min(1),
    FIREBASE_SERVICE_ACCOUNT: z.string().min(1).optional(),
    FIRESTORE_EMULATOR_HOST: z.string().min(1).optional(),
    GCLOUD_PROJECT: z.string().min(1).default('demo-lombada'),
  })
  .refine((env) => env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_SERVICE_ACCOUNT, {
    message: 'obrigatória fora dos emuladores',
    path: ['FIREBASE_SERVICE_ACCOUNT'],
  });

export const ServiceAccountSchema: z.ZodType<ServiceAccount> = z.object({
  project_id: z.string().min(1),
  client_email: z.string().min(1),
  private_key: z.string().min(1),
});
