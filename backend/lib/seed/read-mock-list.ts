import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { MockCatalogSchema, MockListInfoSchema, MockListSchema } from '../schemas/seed.js';
import type { OriginalEntry, OriginalListInfo } from '../types/seed.js';

/** Trecho de state.list no mock: do `list: [` até o `],` que fecha. */
const STATE_LIST = /\n {2}list: (\[[\s\S]*?\n {2}\]),/;
/** Primeiro item de const LISTS no mock. */
const FIRST_LIST = /const LISTS = \[(\{[^\n]*?)(?:, code:|\])/;

/**
 * Lê do mock a lista original: os filmes na ordem do ranking, com data e comentário exatamente como
 * estão, e o id do TMDb de cada um (de mock/data/real.json).
 *
 * @param mockHtmlPath - Caminho de mock/index.html.
 * @param catalogPath - Caminho de mock/data/real.json.
 * @returns Os filmes na ordem do mock.
 * @throws {Error} Se o mock mudou de formato, ou se algum filme estiver sem id do TMDb.
 */
export function readOriginalEntries(mockHtmlPath: string, catalogPath: string): OriginalEntry[] {
  const html = readFileSync(mockHtmlPath, 'utf8');
  const listLiteral = STATE_LIST.exec(html)?.[1];
  if (!listLiteral) throw new Error('state.list não encontrado no mock');

  // O trecho é um literal de JavaScript do próprio mock (chaves sem aspas), avaliado isolado.
  const mockEntries = MockListSchema.parse(runInNewContext(`(${listLiteral})`, {}));
  const catalog = MockCatalogSchema.parse(JSON.parse(readFileSync(catalogPath, 'utf8')));

  return mockEntries.map((entry, index) => {
    const tmdbId = catalog[entry.movieId]?.tmdbId;
    if (!tmdbId) throw new Error(`filme ${entry.movieId} sem tmdbId em real.json`);
    return { position: index + 1, tmdbId, watchedOn: entry.date, comment: entry.comment };
  });
}

/**
 * Lê do mock o nome e a descrição da lista original.
 *
 * @param mockHtmlPath - Caminho de mock/index.html.
 * @returns Nome e descrição.
 * @throws {Error} Se o mock mudou de formato.
 */
export function readOriginalListInfo(mockHtmlPath: string): OriginalListInfo {
  const literal = FIRST_LIST.exec(readFileSync(mockHtmlPath, 'utf8'))?.[1];
  if (!literal) throw new Error('const LISTS não encontrado no mock');
  return MockListInfoSchema.parse(runInNewContext(`(${literal}})`, {}));
}
