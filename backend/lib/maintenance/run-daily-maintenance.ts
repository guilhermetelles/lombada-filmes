import type { Dependencies } from '../types/dependencies.js';
import type { MaintenanceLimits, MaintenanceReport } from '../types/maintenance.js';
import type { UsageRecorder } from '../types/usage.js';
import { deleteExpiredInvites } from './delete-expired-invites.js';
import { refreshStaleMovies } from './refresh-stale-movies.js';

/** Limite do plano: no máximo 100 filmes por execução. */
const DEFAULT_LIMITS: MaintenanceLimits = { movies: 100 };

/**
 * Rotina diária: atualiza as notas vencidas (7 dias) e apaga os códigos de convite vencidos. Dados
 * do TMDb e fichas de pessoas ficam de fora: só são buscados quando alguém abre o filme ou a pessoa.
 *
 * @param dependencies - Banco, clientes das fontes e relógio.
 * @param usage - Medidor de consumo da execução.
 * @param limits - Máximo de filmes por execução.
 * @returns O que foi feito.
 */
async function runDailyMaintenance(
  dependencies: Dependencies,
  usage: UsageRecorder,
  limits: MaintenanceLimits = DEFAULT_LIMITS,
): Promise<MaintenanceReport> {
  const movies = await refreshStaleMovies(dependencies, usage, limits.movies);
  const invitesDeleted = await deleteExpiredInvites(dependencies.db, dependencies.now());
  return { movies, invitesDeleted };
}

export { runDailyMaintenance };
