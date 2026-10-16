/** Variáveis de ambiente já validadas (lib/schemas/env.ts). */
export type Env = {
  TMDB_TOKEN: string;
  CRON_SECRET: string; // a Vercel manda como Bearer nas chamadas do cron
  OMDB_KEY: string;
  FIREBASE_SERVICE_ACCOUNT?: string | undefined; // JSON da conta de serviço; obrigatória fora dos emuladores
  FIRESTORE_EMULATOR_HOST?: string | undefined; // definida por `firebase emulators:exec`
  GCLOUD_PROJECT: string;
};

/** Campos da conta de serviço do Firebase que o Admin SDK usa. */
export type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};
