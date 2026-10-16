import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { checkAgainstExport } from '../../lib/seed/check-against-export.js';
import { parseCsv } from '../../lib/seed/parse-csv.js';
import type { OriginalEntry } from '../../lib/types/seed.js';

/** Escreve um export no formato do Letterboxd (v7), com CRLF dentro das descrições como o real. */
function writeExport(descriptions: string[]): string {
  const films = descriptions.map(
    (description, index) => `${index + 1},Filme,2000,https://boxd.it/x${index},"${description}"`,
  );
  const csv = [
    'Letterboxd list export v7',
    'Date,Name,Tags,URL,Description',
    '2025-04-28,Competição,,https://boxd.it/Gsf3k,"Os filmes que vimos"',
    '',
    'Position,Name,Year,URL,Description',
    ...films,
  ].join('\n');
  const path = join(mkdtempSync(join(tmpdir(), 'lombada-export-')), 'export.csv');
  writeFileSync(path, csv);
  return path;
}

const entry = (position: number, watchedOn: string | null, comment: string): OriginalEntry => ({
  position,
  tmdbId: position,
  watchedOn,
  comment,
});

describe('parseCsv', () => {
  test('aspas com vírgula, quebra de linha e aspas duplicadas', () => {
    assert.deepEqual(parseCsv('a,"b, c","linha 1\nlinha 2","diz ""oi"""\nd,e,,f'), [
      ['a', 'b, c', 'linha 1\nlinha 2', 'diz "oi"'],
      ['d', 'e', '', 'f'],
    ]);
  });
});

describe('conferência do mock contra o export do Letterboxd', () => {
  const csv = writeExport([
    '12/10/25\r\nJames Cameron. ESSE FILME É INCRÍVEL.',
    '12/04/26 - versão estendida \r\nNão tem como, é bom. \r\nSegunda linha.',
    'Primeiro filme no discord.\r\n23/01/25',
    'Sem data.',
  ]);
  const matching = [
    entry(1, '2025-10-12', 'James Cameron. ESSE FILME É INCRÍVEL.'),
    entry(2, '2026-04-12', 'Não tem como, é bom.\nSegunda linha.'),
    entry(3, '2025-01-23', 'Primeiro filme no discord.'),
    entry(4, null, 'Sem data.'),
  ];

  test('aceita o mock quando datas e comentários batem (tirando espaço no fim de linha)', () => {
    assert.doesNotThrow(() => checkAgainstExport(matching, csv));
  });

  test('aponta comentário e data diferentes, com a posição', () => {
    const changed = [
      matching[0] as OriginalEntry,
      { ...(matching[1] as OriginalEntry), comment: 'Reescrito.' },
      { ...(matching[2] as OriginalEntry), watchedOn: '2025-01-24' },
      matching[3] as OriginalEntry,
    ];
    assert.throws(
      () => checkAgainstExport(changed, csv),
      (error: Error) => /posição 2: comentário/.test(error.message) && /posição 3: data/.test(error.message),
    );
  });

  test('quantidade diferente de filmes', () => {
    assert.throws(() => checkAgainstExport(matching.slice(0, 3), csv), /3 filmes e o export tem 4/);
  });
});
