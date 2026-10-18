import { findMovies } from '../movies/movie-repository.js';
import { brazilDay } from '../time/brazil-day.js';
import type { Dependencies } from '../types/dependencies.js';
import type {
  EnrichContext,
  EnrichCount,
  EnrichCursor,
  EnrichLimits,
  EnrichPhase,
  EnrichReport,
  PhaseProgress,
} from '../types/enrich.js';
import type { UsageRecorder } from '../types/usage.js';
import { readEnrichCursor, saveEnrichCursor } from './enrich-cursor.js';
import { enrichMovies } from './enrich-movies.js';
import { enrichPeople } from './enrich-people.js';
import { enrichProviders } from './enrich-providers.js';
import { findRecurrentPeople, readEnrichTargets } from './enrich-targets.js';

/**
 * Limites de produção: para por volta de 240 s (a função tem 300 s), 20 filmes ou pessoas por lote
 * (uma consulta ao Wikidata por lote) e até 100 pedidos à OMDb por execução (a cota é 1.000 por dia).
 */
const DEFAULT_LIMITS: EnrichLimits = { budgetMs: 240_000, batchSize: 20, omdbCalls: 100 };

/** Etapas que trabalham, na ordem. */
const PHASES: Exclude<EnrichPhase, 'done'>[] = ['providers', 'movies', 'people'];

/**
 * Rotina enrich: (1) onde assistir dos filmes da fila, uma vez por dia; (2) campos extras (TMDb e
 * OMDb) e prêmios (Wikidata e Wikipedia) dos filmes das listas e da fila vencidos há 30 dias ou
 * nunca buscados; (3) ficha e prêmios das pessoas recorrentes das listas. Para quando o tempo ou a
 * cota da OMDb acaba e grava onde parou em jobs/enrich; outra execução no mesmo dia (Brasília)
 * continua dali, e num dia novo recomeça. É idempotente: o que está fresco não é buscado nem
 * gravado de novo, e uma segunda execução no mesmo dia, sem nada vencido, não grava nada.
 *
 * @param dependencies - Banco, clientes das fontes e relógio.
 * @param usage - Medidor de consumo da execução.
 * @param limits - Tempo, tamanho do lote e cota da OMDb da execução.
 * @returns O que foi feito.
 */
async function runEnrich(
  dependencies: Dependencies,
  usage: UsageRecorder,
  limits: EnrichLimits = DEFAULT_LIMITS,
): Promise<EnrichReport> {
  const { db } = dependencies;
  const now = dependencies.now();
  const day = brazilDay(now);
  const stored = await readEnrichCursor(db);
  const resume = stored && stored.day === day && stored.phase !== 'done' ? stored : undefined;

  const targets = await readEnrichTargets(db);
  const context: EnrichContext = {
    dependencies,
    usage,
    now,
    limits,
    budget: { expired: () => dependencies.now().getTime() - now.getTime() >= limits.budgetMs },
    movies: await findMovies(db, targets.allMovieIds),
    omdbCallsLeft: limits.omdbCalls,
  };
  const report: EnrichReport = {
    day,
    resumedFrom: resume ? { phase: resume.phase, after: resume.after } : null,
    providers: { updated: 0, failed: 0 },
    movies: { updated: 0, failed: 0 },
    people: { updated: 0, failed: 0 },
    finished: false,
  };

  const runPhase = (phase: Exclude<EnrichPhase, 'done'>, after: number | null): Promise<PhaseProgress> => {
    const count: EnrichCount = report[phase];
    if (phase === 'providers') return enrichProviders(context, targets.queueMovieIds, after, count);
    if (phase === 'movies') return enrichMovies(context, targets.allMovieIds, after, count);
    // As pessoas saem dos filmes já atualizados pela etapa anterior.
    return enrichPeople(context, findRecurrentPeople(targets.moviesByList, context.movies), after, count);
  };

  const first = resume ? PHASES.indexOf(resume.phase as Exclude<EnrichPhase, 'done'>) : 0;
  for (const [index, phase] of PHASES.entries()) {
    if (index < first) continue;
    const progress = await runPhase(phase, index === first ? (resume?.after ?? null) : null);
    if (!progress.completed) {
      await saveCursorIfChanged(db, stored, { day, phase, after: progress.last, updatedAt: dependencies.now() });
      return report;
    }
  }

  await saveCursorIfChanged(db, stored, { day, phase: 'done', after: null, updatedAt: dependencies.now() });
  report.finished = true;
  return report;
}

/**
 * Grava o cursor só quando ele muda (dia, etapa ou posição), para uma execução sem trabalho não
 * gravar nada.
 *
 * @param db - Firestore.
 * @param stored - Cursor lido no começo da execução.
 * @param next - Cursor novo.
 */
async function saveCursorIfChanged(
  db: Dependencies['db'],
  stored: EnrichCursor | undefined,
  next: EnrichCursor,
): Promise<void> {
  if (stored && stored.day === next.day && stored.phase === next.phase && stored.after === next.after) return;
  await saveEnrichCursor(db, next);
}

export { DEFAULT_LIMITS, runEnrich };
