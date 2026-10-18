import { writeFeedItem } from '../feed/write-feed-item.js';
import { createIfAbsent } from '../firestore/idempotent.js';
import type { ListMaterial } from '../quiz/list-material.js';
import { monthLabel } from '../quiz/quiz-text.js';
import type { Dependencies } from '../types/dependencies.js';
import type { Retro } from '../types/retro.js';
import type { UsageRecorder } from '../types/usage.js';
import { buildRetroStats } from './build-retro-stats.js';
import { retroDocument } from './retro-repository.js';
import { writeRetroText } from './retro-text.js';

/** Resultado da retrospectiva de um mês numa lista. */
export type RetroOutcome = 'created' | 'exists' | 'no-films';

/**
 * Escreve uma duração em horas e minutos.
 *
 * @param minutes - Minutos.
 * @returns "5 h 20 min", "2 h" ou "45 min".
 */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/**
 * Gera a retrospectiva do mês da lista (retros/{mês}, só se ainda não houver) e o item `daily.retro`
 * da Atividade (id `retro-{mês}`). Mês sem filme visto não tem retrospectiva nem item. O texto vem
 * do Gemini a partir dos comentários do mês; se ele falhar, a retrospectiva sai só com os números.
 *
 * @param dependencies - Banco, Gemini e relógio.
 * @param usage - Medidor de consumo da rotina.
 * @param material - Entradas, filmes e nomes dos membros da lista.
 * @param month - Mês (AAAA-MM).
 * @returns O que aconteceu.
 */
async function createRetro(
  { db, sources, now }: Dependencies,
  usage: UsageRecorder,
  material: ListMaterial,
  month: string,
): Promise<RetroOutcome> {
  const { listId } = material;
  const ref = retroDocument(db, listId, month);
  const existing = (await ref.get()).data();

  let retro = existing;
  if (!retro) {
    const { stats, monthEntries } = buildRetroStats(material.entries, month);
    if (stats.films === 0) return 'no-films';
    const text = await writeRetroText({ gemini: sources.gemini, usage }, monthEntries, material.memberNames, {
      listId,
      month,
    });
    const fresh: Retro = { month, ...stats, text, generatedAt: now() };
    retro = (await createIfAbsent(ref, fresh)) ? fresh : (await ref.get()).data();
  }
  if (!retro) return 'exists';

  const best = material.entries.find((entry) => entry.entryId === retro.bestEntryId);
  const films = retro.films === 1 ? '1 filme' : `${retro.films} filmes`;
  const bestText = best ? ` O mais bem colocado: ${best.title} (#${best.rank}).` : '';
  await writeFeedItem(
    db,
    listId,
    {
      type: 'daily.retro',
      kind: 'lembrete',
      createdAt: now(),
      title: `Retrospectiva de ${monthLabel(month)}`,
      body: `${films}, ${formatDuration(retro.minutes)}.${bestText}`,
      route: { name: 'retro', args: { month } },
    },
    `retro-${month}`,
  );
  return existing ? 'exists' : 'created';
}

export { createRetro };
