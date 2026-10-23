import type { Firestore } from 'firebase-admin/firestore';
import { logger } from '../logging/logger.js';
import { KeywordLabelsReplySchema } from '../schemas/recs.js';
import { GEMINI_MODELS } from '../sources/gemini/gemini-models.js';
import type { GeminiClient } from '../types/sources.js';
import type { UsageRecorder } from '../types/usage.js';

/** Palavras-chave do TMDb que não dizem nada sobre o filme (marcas de cena pós-créditos, de equipe). */
export const META_KEYWORDS: ReadonlySet<string> = new Set([
  'aftercreditsstinger',
  'duringcreditsstinger',
  'woman director',
  'female director',
  'no opening credits',
  'credits',
]);

/** Instrução da tradução. */
const SYSTEM = [
  'Você traduz palavras-chave de filmes do TMDb, em inglês, para rótulos curtos em português do Brasil.',
  'Responda só com o JSON pedido, um item por palavra recebida, com o nome exatamente como veio.',
  'O rótulo é curto (1 a 4 palavras), em minúsculas (exceto nomes próprios), sem aspas, natural para quem lê',
  '("time travel" → "viagem no tempo", "haunted house" → "casa assombrada", "based on novel or book" → "baseado em livro").',
  'Palavras que não descrevem o filme (marcas técnicas, de produção, de créditos) ficam com rótulo vazio.',
].join('\n');

/** Máximo de palavras por pedido ao Gemini. */
const BATCH_SIZE = 120;

/**
 * Rótulos em português das palavras-chave, por nome em inglês. Lê o que já foi traduzido em
 * keywordLabels/{nome} e manda ao Gemini só as que faltam, num pedido por lote, guardando também as
 * de rótulo vazio (para não perguntar de novo). Palavras de META_KEYWORDS nunca ganham rótulo. Se o
 * Gemini falhar, as que faltam ficam sem rótulo nesta execução: o motivo deixa de citá-las.
 *
 * @param dependencies - Banco, Gemini, consumo e relógio.
 * @param names - Nomes em inglês das palavras-chave.
 * @returns Rótulo de cada palavra que tem um, por nome em inglês.
 */
async function keywordLabels(
  { db, gemini, usage, now }: { db: Firestore; gemini: GeminiClient; usage: UsageRecorder; now: () => Date },
  names: readonly string[],
): Promise<Record<string, string>> {
  const wanted = [...new Set(names.filter((name) => name.trim() !== '' && !META_KEYWORDS.has(name)))];
  const labels: Record<string, string> = {};
  if (wanted.length === 0) return labels;

  const refs = wanted.map((name) => db.collection('keywordLabels').doc(documentId(name)));
  const stored = await db.getAll(...refs);
  const missing: string[] = [];
  stored.forEach((snapshot, index) => {
    const name = wanted[index];
    if (name === undefined) return;
    const label = snapshot.exists ? snapshot.get('label') : undefined;
    if (typeof label === 'string') {
      if (label) labels[name] = label;
    } else {
      missing.push(name);
    }
  });

  for (let start = 0; start < missing.length; start += BATCH_SIZE) {
    const batch = missing.slice(start, start + BATCH_SIZE);
    try {
      const reply = await gemini.generateJson({
        model: GEMINI_MODELS.text,
        purpose: 'recs',
        system: SYSTEM,
        prompt: JSON.stringify(batch),
        schema: KeywordLabelsReplySchema,
        usage,
      });
      const translated = new Map(reply.labels.map((item) => [item.name, item.label.trim()]));
      const writer = db.batch();
      for (const name of batch) {
        const label = translated.get(name);
        if (label === undefined) continue;
        writer.set(db.collection('keywordLabels').doc(documentId(name)), { name, label, at: now() });
        if (label) labels[name] = label;
      }
      await writer.commit();
    } catch (error) {
      logger.warn('palavras-chave não traduzidas nesta execução', { count: batch.length, error });
    }
  }
  return labels;
}

/**
 * Id do documento de uma palavra: o nome sem barras (que separariam o caminho).
 *
 * @param name - Nome em inglês.
 * @returns O id.
 */
function documentId(name: string): string {
  return name.replaceAll('/', ' ').slice(0, 200);
}

export { keywordLabels };
