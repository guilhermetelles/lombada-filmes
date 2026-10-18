import { logger } from '../logging/logger.js';
import { runInBatches } from '../maintenance/run-in-batches.js';
import { isAwardsStale } from '../movies/freshness.js';
import { getFreshPerson } from '../people/get-fresh-person.js';
import { findPerson, savePerson } from '../people/person-repository.js';
import type { EnrichContext, EnrichCount, PhaseProgress } from '../types/enrich.js';
import type { Person } from '../types/person.js';
import type { AwardsById } from '../types/sources.js';
import { mergeAwards } from './merge-awards.js';
import { processInOrder } from './process-in-order.js';

/** Quantas pessoas ler ou buscar ao mesmo tempo. */
const CONCURRENCY = 4;

/**
 * Etapa das pessoas recorrentes (quem dirige ou atua em 2 ou mais filmes de uma lista): garante a
 * ficha em people/{id} (TMDb, frescor de 30 dias, de onde saem os aniversários) e grava os prêmios
 * do Wikidata, uma consulta por lote, para quem não tem prêmios ou os tem há 30 dias ou mais.
 *
 * @param context - Dependências, momento, limites e tempo.
 * @param personIds - Pessoas recorrentes, em ordem crescente.
 * @param after - Última pessoa tratada numa execução anterior do mesmo dia, ou null.
 * @param count - Contadores a atualizar.
 * @returns Até onde a etapa chegou.
 */
async function enrichPeople(
  context: EnrichContext,
  personIds: number[],
  after: number | null,
  count: EnrichCount,
): Promise<PhaseProgress> {
  const pending = after === null ? personIds : personIds.filter((personId) => personId > after);
  const stored = await findPeople(context, pending);
  const stale = pending.filter((personId) => {
    const person = stored.get(personId);
    return !person || isAwardsStale(person, context.now);
  });

  return processInOrder(stale, after, context.limits.batchSize, context.budget, async (batch) => {
    await enrichPeopleBatch(context, batch, count);
    return batch.length;
  });
}

/**
 * Lê as fichas guardadas das pessoas, poucas de cada vez.
 *
 * @param context - Banco.
 * @param personIds - Pessoas.
 * @returns As fichas encontradas, por id.
 */
async function findPeople(context: EnrichContext, personIds: number[]): Promise<Map<number, Person>> {
  const people = new Map<number, Person>();
  await runInBatches(personIds, CONCURRENCY * 4, async (personId) => {
    try {
      const person = await findPerson(context.dependencies.db, personId);
      if (person) people.set(personId, person);
    } catch (error) {
      // Ficha fora do formato conta como ausente: getFreshPerson busca e grava de novo.
      logger.warn('rotina enrich: ficha de pessoa fora do formato', { personId, error });
    }
  });
  return people;
}

/**
 * Trata um lote de pessoas: fichas pelo TMDb, prêmios pelo Wikidata e gravação.
 *
 * @param context - Dependências, momento e medidor de consumo.
 * @param batch - Pessoas do lote.
 * @param count - Contadores a atualizar.
 */
async function enrichPeopleBatch(context: EnrichContext, batch: number[], count: EnrichCount): Promise<void> {
  const people = new Map<number, Person>();
  await runInBatches(batch, CONCURRENCY, async (personId) => {
    try {
      people.set(personId, await getFreshPerson(personId, context.dependencies, context.usage));
    } catch (error) {
      logger.warn('rotina enrich: ficha de pessoa não buscada', { personId, error });
    }
  });
  count.failed += batch.length - people.size;
  if (people.size === 0) return;

  let awards: AwardsById;
  try {
    const ids = [...people.keys()];
    awards = await context.usage.track('wikidata', () =>
      context.dependencies.sources.wikidata.personAwardsByTmdbIds(ids),
    );
  } catch (error) {
    count.failed += people.size;
    logger.warn('rotina enrich: prêmios de pessoas não buscados', { personIds: [...people.keys()], error });
    return;
  }

  for (const [personId, person] of people) {
    try {
      const items = mergeAwards(awards.get(personId) ?? []);
      await savePerson(context.dependencies.db, personId, {
        ...person,
        awards: { items, summary: null, fetchedAt: context.now },
      });
      count.updated++;
    } catch (error) {
      count.failed++;
      logger.warn('rotina enrich: pessoa não gravada', { personId, error });
    }
  }
}

export { enrichPeople };
