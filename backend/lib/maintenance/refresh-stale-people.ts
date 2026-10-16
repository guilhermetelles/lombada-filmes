import { logger } from '../logging/logger.js';
import { getFreshPerson } from '../people/get-fresh-person.js';
import { isPersonStale } from '../people/person-freshness.js';
import { PersonSchema } from '../schemas/person.js';
import type { Dependencies } from '../types/dependencies.js';
import type { UsageRecorder } from '../types/usage.js';
import { runInBatches } from './run-in-batches.js';

/** Quantas pessoas buscar ao mesmo tempo. */
const CONCURRENCY = 4;

/**
 * Atualiza as pessoas buscadas há 30 dias ou mais, da mais antiga para a mais recente.
 *
 * @param dependencies - Banco, clientes das fontes e relógio.
 * @param usage - Medidor de consumo da execução.
 * @param limit - No máximo quantas pessoas nesta execução.
 * @returns Quantas foram atualizadas e quantas falharam.
 */
async function refreshStalePeople(
  dependencies: Dependencies,
  usage: UsageRecorder,
  limit: number,
): Promise<{ refreshed: number; failed: number }> {
  const now = dependencies.now();
  const people = await dependencies.db.collection('people').get();
  const stale = people.docs
    // Um documento fora do formato não pode derrubar a rotina inteira: fica de fora, registrado.
    .flatMap((doc) => {
      const personId = Number(doc.id);
      const parsed = PersonSchema.safeParse(doc.data());
      if (parsed.success) return [{ personId, person: parsed.data }];
      logger.warn('rotina diária: pessoa fora do formato, pulado', { personId });
      return [];
    })
    .filter(({ person }) => isPersonStale(person, now))
    .sort((a, b) => a.person.fetchedAt.getTime() - b.person.fetchedAt.getTime())
    .slice(0, limit);

  let failed = 0;
  await runInBatches(stale, CONCURRENCY, async ({ personId }) => {
    try {
      await getFreshPerson(personId, dependencies, usage);
    } catch (error) {
      failed++;
      logger.warn('rotina diária: pessoa não atualizada', { personId, error });
    }
  });
  return { refreshed: stale.length - failed, failed };
}

export { refreshStalePeople };
