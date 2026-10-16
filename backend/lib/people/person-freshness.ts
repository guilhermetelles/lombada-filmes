import { DAY_MS } from '../time/durations.js';
import type { Person } from '../types/person.js';

/** Biografia e filmografia mudam pouco: cada pessoa é buscada de novo só depois de 30 dias. */
const PERSON_FRESHNESS_MS = 30 * DAY_MS;

/**
 * Diz se a pessoa precisa ser buscada de novo: nunca buscada, ou buscada há 30 dias ou mais.
 *
 * @param person - Documento guardado, se existir.
 * @param now - Momento de referência.
 * @returns true se a pessoa estiver vencida.
 */
function isPersonStale(person: Person | undefined, now: Date): boolean {
  if (!person) return true;
  return now.getTime() - person.fetchedAt.getTime() >= PERSON_FRESHNESS_MS;
}

export { isPersonStale, PERSON_FRESHNESS_MS };
