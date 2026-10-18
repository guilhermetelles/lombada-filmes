import { logger } from '../logging/logger.js';
import type { Dependencies } from '../types/dependencies.js';
import type { Person } from '../types/person.js';
import type { UsageRecorder } from '../types/usage.js';
import { isPersonStale } from './person-freshness.js';
import { findPerson, savePerson } from './person-repository.js';

/**
 * Devolve people/{personId} buscado há menos de 30 dias, indo ao TMDb só quando venceu. Se o TMDb
 * falhar e já houver um documento guardado, o guardado continua valendo.
 *
 * @param personId - Id de pessoa no TMDb.
 * @param dependencies - Banco, clientes das fontes e relógio.
 * @param usage - Medidor de consumo do pedido.
 * @returns O documento da pessoa.
 * @throws {NotFoundError} Se a pessoa ainda não estiver guardada e o TMDb não a tiver.
 * @throws {SourceUnavailableError} Se a pessoa ainda não estiver guardada e o TMDb falhar.
 */
async function getFreshPerson(
  personId: number,
  { db, sources, now }: Dependencies,
  usage: UsageRecorder,
): Promise<Person> {
  const stored = await findPerson(db, personId);
  const fetchedAt = now();

  if (stored && !isPersonStale(stored, fetchedAt)) {
    usage.count('tmdb', 'cacheHits');
    return stored;
  }

  try {
    const fresh = await usage.track('tmdb', () => sources.tmdb.getPerson(personId));
    // Os prêmios vêm da rotina enrich (Wikidata), não do TMDb: a nova busca não pode apagá-los.
    const person: Person = { ...fresh, fetchedAt, ...(stored?.awards ? { awards: stored.awards } : {}) };
    await savePerson(db, personId, person);
    return person;
  } catch (error) {
    if (!stored) throw error;
    logger.warn('TMDb falhou; mantendo a pessoa guardada', { personId, error });
    return stored;
  }
}

export { getFreshPerson };
