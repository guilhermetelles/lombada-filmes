import type { Dependencies } from '../types/dependencies.js';
import type { MaintenanceLimits, MaintenanceReport } from '../types/maintenance.js';
import type { UsageRecorder } from '../types/usage.js';
import { deleteExpiredInvites } from './delete-expired-invites.js';
import { deleteOldRecords } from './delete-old-records.js';
import { refreshStaleMovies } from './refresh-stale-movies.js';
import { updateBechdel } from './update-bechdel.js';

/** Limites do plano: no máximo 100 filmes com notas e 30 casamentos novos do Teste de Bechdel por execução. */
const DEFAULT_LIMITS: MaintenanceLimits = { movies: 100, bechdelMatches: 30 };

/**
 * Rotina diária: atualiza as notas vencidas (7 dias), atualiza o Teste de Bechdel (um índice por
 * execução), apaga os códigos de convite vencidos e limpa a Atividade com mais de 180 dias, o
 * notifyLog e o rateLimits com mais de 45 dias (até 500 de cada por execução). Dados do TMDb e fichas de pessoas ficam de
 * fora: são atualizados quando alguém abre o filme ou a pessoa.
 *
 * @param dependencies - Banco, clientes das fontes e relógio.
 * @param usage - Medidor de consumo da execução.
 * @param limits - Máximo de filmes com notas e de casamentos do Teste de Bechdel por execução.
 * @returns O que foi feito.
 */
async function runDailyMaintenance(
  dependencies: Dependencies,
  usage: UsageRecorder,
  limits: MaintenanceLimits = DEFAULT_LIMITS,
): Promise<MaintenanceReport> {
  const movies = await refreshStaleMovies(dependencies, usage, limits.movies);
  const bechdel = await updateBechdel(dependencies, usage, limits.bechdelMatches);
  const invitesDeleted = await deleteExpiredInvites(dependencies.db, dependencies.now());
  const deleted = await deleteOldRecords(dependencies.db, dependencies.now());
  return { movies, bechdel, invitesDeleted, deleted };
}

export { runDailyMaintenance };
