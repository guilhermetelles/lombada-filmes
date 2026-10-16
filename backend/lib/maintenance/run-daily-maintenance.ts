import type { Dependencies } from '../types/dependencies.js';
import type { MaintenanceLimits, MaintenanceReport } from '../types/maintenance.js';
import type { UsageRecorder } from '../types/usage.js';
import { deleteExpiredInvites } from './delete-expired-invites.js';
import { refreshStaleMovies } from './refresh-stale-movies.js';
import { refreshStalePeople } from './refresh-stale-people.js';

/** Limites do plano: no máximo 100 filmes por execução; pessoas mudam menos, 50 bastam. */
const DEFAULT_LIMITS: MaintenanceLimits = { movies: 100, people: 50 };

/**
 * Rotina diária: atualiza filmes com nota vencida (7 dias), pessoas vencidas (30 dias) e apaga os
 * códigos de convite vencidos.
 *
 * @param dependencies - Banco, clientes das fontes e relógio.
 * @param usage - Medidor de consumo da execução.
 * @param limits - Máximo de filmes e de pessoas por execução.
 * @returns O que foi feito.
 */
async function runDailyMaintenance(
  dependencies: Dependencies,
  usage: UsageRecorder,
  limits: MaintenanceLimits = DEFAULT_LIMITS,
): Promise<MaintenanceReport> {
  const movies = await refreshStaleMovies(dependencies, usage, limits.movies);
  const people = await refreshStalePeople(dependencies, usage, limits.people);
  const invitesDeleted = await deleteExpiredInvites(dependencies.db, dependencies.now());
  return { movies, people, invitesDeleted };
}

export { runDailyMaintenance };
