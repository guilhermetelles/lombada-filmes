import type { Firestore } from 'firebase-admin/firestore';
import { logger } from '../logging/logger.js';
import type { InterpretKeyword, InterpretTerm } from '../types/discover.js';
import type { UsageRecorder } from '../types/usage.js';
import type { TmdbDiscoverClient, TmdbKeyword } from './tmdb-discover-client.js';

/** Máximo de palavras-chave por busca. */
export const MAX_KEYWORDS = 5;

/** O que fica guardado em keywordIds/{termo}: o id achado no TMDb, ou null se não há palavra-chave. */
type CachedKeyword = { term: string; id: number | null; name: string | null; at: Date };

/**
 * Acha o id do TMDb de cada termo que o Gemini tirou do texto (`/search/keyword`), guardando o
 * resultado em keywordIds/{termo} para a mesma palavra não ser buscada de novo. Prefere o nome
 * igual ao termo; sem ele, o primeiro resultado. Termo sem palavra-chave fica de fora, e uma falha
 * do TMDb só deixa o termo de fora.
 *
 * @param dependencies - Banco, cliente do TMDb, consumo e relógio.
 * @param terms - Termos em inglês com o rótulo em português, na ordem do texto.
 * @returns As palavras-chave achadas, sem repetir id, até 5.
 */
async function resolveKeywords(
  { db, tmdb, usage, now }: { db: Firestore; tmdb: TmdbDiscoverClient; usage: UsageRecorder; now: () => Date },
  terms: readonly InterpretTerm[],
): Promise<InterpretKeyword[]> {
  const found: InterpretKeyword[] = [];
  for (const { term, label } of terms.slice(0, MAX_KEYWORDS)) {
    const key = normalizeTerm(term);
    if (!key) continue;
    const id = await keywordIdOf(db, tmdb, usage, now, key);
    if (id !== null && !found.some((keyword) => keyword.id === id)) found.push({ id, label: label.trim() || term });
  }
  return found;
}

/**
 * Id da palavra-chave de um termo, lido do cache ou buscado no TMDb.
 *
 * @param db - Firestore.
 * @param tmdb - Cliente do TMDb.
 * @param usage - Medidor de consumo.
 * @param now - Relógio.
 * @param key - Termo normalizado.
 * @returns O id, ou null se não houver palavra-chave ou o TMDb falhar.
 */
async function keywordIdOf(
  db: Firestore,
  tmdb: TmdbDiscoverClient,
  usage: UsageRecorder,
  now: () => Date,
  key: string,
): Promise<number | null> {
  const ref = db.collection('keywordIds').doc(key);
  const cached = (await ref.get()).data() as CachedKeyword | undefined;
  if (cached) return cached.id;
  try {
    const results = await usage.track('tmdb', () => tmdb.searchKeyword(key));
    const best = bestMatch(key, results);
    const entry: CachedKeyword = { term: key, id: best?.id ?? null, name: best?.name ?? null, at: now() };
    await ref.set(entry);
    return entry.id;
  } catch (error) {
    logger.warn('palavra-chave não buscada no TMDb', { term: key, error });
    return null;
  }
}

/**
 * Escolhe a palavra-chave do termo: o nome igual (sem caixa), senão a primeira da busca.
 *
 * @param key - Termo normalizado.
 * @param results - Resultado de /search/keyword.
 * @returns A palavra-chave, ou undefined se a busca veio vazia.
 */
function bestMatch(key: string, results: readonly TmdbKeyword[]): TmdbKeyword | undefined {
  return results.find((keyword) => normalizeTerm(keyword.name) === key) ?? results[0];
}

/**
 * Termo em minúsculas, sem espaços repetidos e sem barras (vira id de documento).
 *
 * @param term - Termo.
 * @returns O termo normalizado, ou vazio.
 */
function normalizeTerm(term: string): string {
  return term.toLowerCase().replaceAll('/', ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

export { normalizeTerm, resolveKeywords };
