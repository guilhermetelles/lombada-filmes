import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { readOriginalEntries, readOriginalListInfo } from '../../lib/seed/read-mock-list.js';

/** Escreve um mock mínimo, no mesmo formato de mock/index.html, e o real.json dele. */
function writeMock(catalog: Record<string, unknown>): { html: string; catalog: string } {
  const dir = mkdtempSync(join(tmpdir(), 'lombada-mock-'));
  const html = join(dir, 'index.html');
  const catalogPath = join(dir, 'real.json');
  writeFileSync(
    html,
    [
      '<script>',
      "const LISTS = [{ id: 'competicao', name: 'Competição de filmes terríveis', description: 'Os filmes que vimos', code: '7Q4KMX', entries: state.list }];",
      'const state = {',
      '  list: [',
      '    { id: 1, movieId: "abyss", date: "2025-10-12", comment: "Linha um.\\nLinha \\"dois\\"." },',
      '    { id: 2, movieId: "room", date: null, comment: "" },',
      '  ],',
      '  view: "list",',
      '};',
      '</script>',
    ].join('\n'),
  );
  writeFileSync(catalogPath, JSON.stringify(catalog));
  return { html, catalog: catalogPath };
}

describe('leitura do mock', () => {
  test('filmes na ordem, com data, comentário exato e id do TMDb', () => {
    const mock = writeMock({ abyss: { tmdbId: 2756, title: 'The Abyss' }, room: { tmdbId: 17473 } });

    assert.deepEqual(readOriginalEntries(mock.html, mock.catalog), [
      { position: 1, tmdbId: 2756, watchedOn: '2025-10-12', comment: 'Linha um.\nLinha "dois".' },
      { position: 2, tmdbId: 17473, watchedOn: null, comment: '' },
    ]);
  });

  test('nome e descrição da lista', () => {
    const mock = writeMock({});
    assert.deepEqual(readOriginalListInfo(mock.html), {
      name: 'Competição de filmes terríveis',
      description: 'Os filmes que vimos',
    });
  });

  test('filme sem id do TMDb interrompe a carga', () => {
    const mock = writeMock({ abyss: { tmdbId: 2756 }, room: { tmdbId: null } });
    assert.throws(() => readOriginalEntries(mock.html, mock.catalog), /room sem tmdbId/);
  });
});
