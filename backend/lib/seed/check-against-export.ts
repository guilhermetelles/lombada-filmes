import { readFileSync } from 'node:fs';
import type { OriginalEntry } from '../types/seed.js';
import { parseCsv } from './parse-csv.js';

/** Cabeçalho da tabela de filmes no export de lista do Letterboxd. */
const FILMS_HEADER = 'Position,Name,Year,URL,Description';
/** Primeira data DD/MM/AA (ou AAAA) da descrição, que é a data em que o filme foi visto. */
const WATCHED_DATE = /(\d{2})\/(\d{2})\/(\d{2,4})/;
/** Linha da descrição que traz a data (e às vezes uma observação, como "versão estendida"). */
const DATE_LINE = /^\s*\d{2}\/\d{2}\/\d{2,4}\b.*$/;

type ExportedFilm = { position: number; watchedOn: string | null; comment: string };

/**
 * Confere os filmes lidos do mock contra o export do Letterboxd (data/), que é a fonte verbatim
 * dos comentários e das datas. A única diferença aceita é espaço no fim de linha, que o mock tirou.
 *
 * @param entries - Filmes lidos do mock, na ordem.
 * @param exportCsvPath - Caminho do CSV exportado do Letterboxd.
 * @throws {Error} Com a lista das posições divergentes, se a quantidade, uma data ou um comentário não baterem.
 */
function checkAgainstExport(entries: OriginalEntry[], exportCsvPath: string): void {
  const exported = readExportedFilms(exportCsvPath);
  if (exported.length !== entries.length) {
    throw new Error(`o mock tem ${entries.length} filmes e o export tem ${exported.length}`);
  }

  const mismatches = entries.flatMap((entry, index) => {
    const film = exported[index];
    if (!film || film.position !== entry.position) return [`posição ${entry.position}: fora de ordem`];
    const problems: string[] = [];
    if (film.watchedOn !== entry.watchedOn)
      problems.push(`posição ${entry.position}: data ${entry.watchedOn} ≠ ${film.watchedOn}`);
    if (film.comment !== entry.comment) problems.push(`posição ${entry.position}: comentário diferente do export`);
    return problems;
  });
  if (mismatches.length > 0) throw new Error(`o mock não bate com o export do Letterboxd:\n${mismatches.join('\n')}`);
}

/**
 * Lê do export a posição, a data e o comentário de cada filme.
 *
 * @param exportCsvPath - Caminho do CSV exportado do Letterboxd.
 * @returns Os filmes, na ordem do export.
 * @throws {Error} Se o CSV não tiver a tabela de filmes.
 */
function readExportedFilms(exportCsvPath: string): ExportedFilm[] {
  const rows = parseCsv(readFileSync(exportCsvPath, 'utf8'));
  const header = rows.findIndex((row) => row.join(',') === FILMS_HEADER);
  if (header === -1) throw new Error('export do Letterboxd sem a tabela de filmes');

  return rows
    .slice(header + 1)
    .filter((row) => row.length >= 5)
    .map(([position = '', , , , rawDescription = '']) => {
      // O export usa CRLF dentro das descrições; o `.` das expressões regulares não casa com \r.
      const description = rawDescription.replace(/\r\n?/g, '\n');
      return { position: Number(position), watchedOn: watchedOnFrom(description), comment: commentFrom(description) };
    });
}

/**
 * Tira da descrição a data em que o filme foi visto.
 *
 * @param description - Descrição do filme no export.
 * @returns A data como AAAA-MM-DD, ou null se não houver.
 */
function watchedOnFrom(description: string): string | null {
  const match = WATCHED_DATE.exec(description);
  if (!match) return null;
  const [, day, month, year = ''] = match;
  return `${year.length === 2 ? `20${year}` : year}-${month}-${day}`;
}

/**
 * Tira da descrição o comentário: sem as linhas de data e sem espaço no fim de cada linha.
 *
 * @param description - Descrição do filme no export.
 * @returns O comentário.
 */
function commentFrom(description: string): string {
  return description
    .split('\n')
    .filter((line) => !DATE_LINE.test(line))
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

export { checkAgainstExport };
