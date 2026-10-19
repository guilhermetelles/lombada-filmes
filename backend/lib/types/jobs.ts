/** Saúde das rotinas do Vercel Cron: jobs/{nome}, gravado no fim de cada execução (só o backend lê e grava). */

/** Rotinas que gravam a saúde, com o nome do documento em jobs/. */
export type JobName =
  | 'enrich'
  | 'recs'
  | 'quiz-and-month'
  | 'daily'
  | 'notify-09'
  | 'notify-12'
  | 'notify-19'
  | 'notify-21';

/** Como a execução terminou: tudo certo, com falhas ou pendências, ou com erro. */
export type JobStatus = 'ok' | 'partial' | 'failed';

/** O que a rotina diz da própria execução. */
export type JobOutcome = {
  status: JobStatus;
  summary: string; // frase curta em português
  warnings: string[]; // até 10, cada um curto
};

/** Campos de saúde em jobs/{nome} (jobs/enrich guarda também o cursor da rotina). */
export type JobHealth = JobOutcome & {
  lastRunAt: Date;
  durationMs: number;
};
