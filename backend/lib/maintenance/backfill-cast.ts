import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { logger } from '../logging/logger.js';
import { savePerson } from '../people/person-repository.js';
import type { Dependencies } from '../types/dependencies.js';
import type { BackfillCount, BackfillReport } from '../types/maintenance.js';
import type { UsageRecorder } from '../types/usage.js';
import { runInBatches } from './run-in-batches.js';

/** Quantos pedidos ao TMDb ao mesmo tempo. */
const CONCURRENCY = 4;

/** O que a recarga recebe: dependências, medidor de consumo e se é só ensaio. */
type BackfillInput = {
  dependencies: Dependencies;
  usage: UsageRecorder;
  dryRun: boolean;
  onProgress?: (message: string) => void;
};

/**
 * Recarga única do passo 9: grava o elenco nos filmes guardados antes dele (1 pedido de créditos
 * por filme, sem mexer nas notas) e busca de novo as pessoas sem os filmes atuados. Olha o
 * documento cru, então só pega o que falta e pode rodar de novo sem repetir trabalho. No ensaio
 * (`dryRun`), busca tudo no TMDb mas não grava nada.
 *
 * @param input - Dependências, medidor de consumo, ensaio ou não e aviso de progresso.
 * @returns Quantos documentos faltavam, quantos foram gravados e quantos falharam, por coleção.
 */
async function backfillCast({
  dependencies,
  usage,
  dryRun,
  onProgress = () => {},
}: BackfillInput): Promise<BackfillReport> {
  const { db, sources, now } = dependencies;

  const movies = await db.collection('movies').get();
  const moviesReport = await processMissing(movies.docs, 'cast', async (doc) => {
    const cast = await usage.track('tmdb', () => sources.tmdb.getCast(Number(doc.id)));
    if (!dryRun) await doc.ref.update({ cast });
    onProgress(`filme ${doc.id} ${String(doc.get('title'))}: ${cast.length} no elenco, 1º ${cast[0]?.name ?? '—'}`);
  });

  const people = await db.collection('people').get();
  const peopleReport = await processMissing(people.docs, 'acted', async (doc) => {
    const personId = Number(doc.id);
    const person = await usage.track('tmdb', () => sources.tmdb.getPerson(personId));
    if (!dryRun) await savePerson(db, personId, { ...person, fetchedAt: now() });
    onProgress(`pessoa ${doc.id} ${person.name}: ${person.actedCount} filmes atuados`);
  });

  return { movies: withUpdated(moviesReport, dryRun), people: withUpdated(peopleReport, dryRun) };
}

/**
 * Roda a tarefa para cada documento que ainda não tem o campo, poucos de cada vez.
 *
 * @param docs - Documentos da coleção.
 * @param field - Campo novo que marca o documento como já recarregado.
 * @param task - Busca e grava um documento; uma falha é registrada e não para as outras.
 * @returns Quantos faltavam e quantos falharam.
 */
async function processMissing(
  docs: DocumentSnapshot[],
  field: string,
  task: (doc: DocumentSnapshot) => Promise<void>,
): Promise<{ missing: number; failed: number }> {
  const missing = docs.filter((doc) => doc.get(field) === undefined);
  let failed = 0;
  await runInBatches(missing, CONCURRENCY, async (doc) => {
    try {
      await task(doc);
    } catch (error) {
      failed++;
      logger.warn('recarga do elenco: documento não atualizado', { path: doc.ref.path, error });
    }
  });
  return { missing: missing.length, failed };
}

/**
 * Completa a contagem com quantos foram gravados.
 *
 * @param count - Faltantes e falhas.
 * @param dryRun - Se foi só ensaio (nada gravado).
 * @returns A contagem completa.
 */
function withUpdated({ missing, failed }: { missing: number; failed: number }, dryRun: boolean): BackfillCount {
  return { missing, updated: dryRun ? 0 : missing - failed, failed };
}

export { backfillCast };
