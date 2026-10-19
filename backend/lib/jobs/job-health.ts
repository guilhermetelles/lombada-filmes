import type { Firestore } from 'firebase-admin/firestore';
import { logger } from '../logging/logger.js';
import type { CronContext } from '../types/http.js';
import type { JobHealth, JobName, JobOutcome } from '../types/jobs.js';

/** Máximo de avisos guardados por execução. */
export const MAX_JOB_WARNINGS = 10;

/** Tamanho máximo do resumo e de cada aviso. */
const MAX_TEXT_LENGTH = 200;

/**
 * Roda uma rotina e grava a saúde dela em jobs/{nome}: quando começou, quanto durou, como terminou,
 * um resumo e os avisos (os da rotina mais "Gemini sem cota: {modelo}" para cada modelo que
 * respondeu 429 na execução). Se a rotina lançar, grava `failed` com o motivo e lança de novo. A
 * gravação da saúde nunca derruba a rotina.
 *
 * @param context - Dependências e medidor de consumo da execução.
 * @param name - Nome da rotina (id do documento em jobs/).
 * @param run - A rotina.
 * @param describe - Resume o relatório da rotina em situação, frase e avisos.
 * @returns O relatório da rotina.
 * @throws O mesmo erro da rotina, depois de gravada a falha.
 */
async function runJob<Report>(
  { dependencies, usage }: CronContext,
  name: JobName,
  run: () => Promise<Report>,
  describe: (report: Report) => JobOutcome,
): Promise<Report> {
  const lastRunAt = dependencies.now();
  const startedAt = Date.now();
  const quotaWarnings = () => usage.geminiQuotaHits().map((model) => `Gemini sem cota: ${model}`);
  try {
    const report = await run();
    const outcome = describe(report);
    await recordJobHealth(dependencies.db, name, {
      ...outcome,
      warnings: [...outcome.warnings, ...quotaWarnings()],
      lastRunAt,
      durationMs: Date.now() - startedAt,
    });
    return report;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await recordJobHealth(dependencies.db, name, {
      status: 'failed',
      summary: `Falhou: ${reason}`,
      warnings: quotaWarnings(),
      lastRunAt,
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}

/**
 * Grava a saúde de uma execução em jobs/{nome}, com merge (jobs/enrich guarda também o cursor).
 * Corta o resumo e os avisos e guarda no máximo 10 avisos. Uma falha vai para o log.
 *
 * @param db - Firestore.
 * @param name - Nome da rotina.
 * @param health - Saúde da execução.
 */
async function recordJobHealth(db: Firestore, name: JobName, health: JobHealth): Promise<void> {
  const shorten = (text: string) => (text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH - 1)}…` : text);
  try {
    await db.doc(`jobs/${name}`).set(
      {
        lastRunAt: health.lastRunAt,
        durationMs: health.durationMs,
        status: health.status,
        summary: shorten(health.summary),
        warnings: [...new Set(health.warnings)].slice(0, MAX_JOB_WARNINGS).map(shorten),
      },
      { merge: true },
    );
  } catch (error) {
    logger.error('saúde da rotina não gravada', { name, error });
  }
}

export { recordJobHealth, runJob };
