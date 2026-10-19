import * as z from 'zod';
import type { JobHealth, JobName, JobStatus } from '../types/jobs.js';
import { firestoreDate } from './firestore.js';

/** Rotinas que gravam a saúde em jobs/{nome}, na ordem em que rodam no dia. */
export const JOB_NAMES = [
  'enrich',
  'recs',
  'quiz-and-month',
  'daily',
  'notify-09',
  'notify-12',
  'notify-19',
  'notify-21',
] as const satisfies readonly JobName[];

/** Situação de uma execução. */
export const JobStatusSchema: z.ZodType<JobStatus> = z.enum(['ok', 'partial', 'failed']);

/** Campos de saúde de jobs/{nome}, validados ao ler (os outros campos, como o cursor do enrich, ficam de fora). */
export const JobHealthSchema: z.ZodType<JobHealth> = z.object({
  lastRunAt: firestoreDate,
  durationMs: z.number().nonnegative(),
  status: JobStatusSchema,
  summary: z.string(),
  warnings: z.array(z.string()),
});
