import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { RankedEntry } from '../../lib/events/list-entries.js';
import {
  type EntryEvent,
  type RequestedEvent,
  selectValidEvents,
  type ValidEvent,
} from '../../lib/events/select-valid-events.js';
import { summarizeEvents } from '../../lib/events/summarize-events.js';
import { rankedEntry } from '../daily/daily-samples.js';

const now = new Date('2026-10-18T22:00:00Z');
const fresh = new Date('2026-10-18T21:50:00Z');

/** Lista de 4 filmes; Ana gravou todas as entradas há 10 minutos. */
const entries: RankedEntry[] = [
  { entryId: 'e-speed', tmdbId: 1637, title: 'Speed', comment: 'Comentário novo de Speed.' },
  { entryId: 'e-abyss', tmdbId: 2756, title: 'The Abyss', comment: 'Fundo do mar.' },
  { entryId: 'e-twister', tmdbId: 664, title: 'Twister' },
  { entryId: 'e-heat', tmdbId: 949, title: 'Heat' },
].map((sample, index) => rankedEntry({ ...sample, updatedAt: fresh }, index + 1));

const byId = (entryId: string): RankedEntry => {
  const entry = entries.find((candidate) => candidate.entryId === entryId);
  if (!entry) throw new Error(`entrada de teste ausente: ${entryId}`);
  return entry;
};
const event = (type: EntryEvent['type'], entryId: string): ValidEvent => ({ type, entry: byId(entryId) });
const noTitles = new Map<number, string>();

describe('summarizeEvents', () => {
  test('um filme adicionado: abre o filme, diz a posição e cita o comentário guardado', () => {
    assert.deepEqual(summarizeEvents('Ana', [event('added', 'e-abyss')], 4), {
      title: 'Ana adicionou The Abyss',
      body: 'Entrou em #2 de 4.',
      quote: 'Fundo do mar.',
      route: { name: 'movie', args: { tmdbId: 2756 } },
    });
  });

  test('lote misto: uma frase só, as posições e o comentário da última entrada comentada', () => {
    const summary = summarizeEvents(
      'Ana',
      [
        event('added', 'e-abyss'),
        event('moved', 'e-speed'),
        event('moved', 'e-twister'),
        event('moved', 'e-heat'),
        event('moved', 'e-abyss'),
        event('commented', 'e-speed'),
      ],
      4,
    );
    assert.deepEqual(summary, {
      title: 'Ana adicionou The Abyss, reordenou 3 filmes e comentou Speed',
      body: 'Entrou em #2 de 4. Novas posições: Speed (#1), Twister (#3) e Heat (#4).',
      quote: 'Comentário novo de Speed.',
      route: { name: 'feed' },
    });
  });

  test('um filme movido diz para onde; vários adicionados viram contagem', () => {
    assert.equal(summarizeEvents('Ana', [event('moved', 'e-heat')], 4).title, 'Ana moveu Heat para #4');
    const many = summarizeEvents(
      'Ana',
      ['e-speed', 'e-abyss', 'e-twister', 'e-heat'].map((id) => event('added', id)),
      4,
    );
    assert.equal(many.title, 'Ana adicionou 4 filmes');
    assert.equal(many.body, 'Entraram: Speed (#1), The Abyss (#2), Twister (#3) e mais 1.');
  });

  test('sem comentário não há citação; conta sem nome usa "Alguém da lista"', () => {
    const summary = summarizeEvents('', [event('moved', 'e-twister'), event('commented', 'e-twister')], 4);
    assert.equal(summary.title, 'Alguém da lista moveu Twister para #3 e comentou Twister');
    assert.equal(summary.quote, undefined);
    assert.equal(summary.body, undefined);
  });
});

describe('selectValidEvents', () => {
  const others = entries.map((entry) =>
    entry.entryId === 'e-heat' ? { ...entry, updatedBy: 'bia', addedBy: 'bia' } : entry,
  );

  test('ignora entrada de outra pessoa, velha, inexistente e repetida', () => {
    const old = { ...byId('e-twister'), updatedAt: new Date('2026-10-18T21:29:00Z') };
    const list = others.map((entry) => (entry.entryId === 'e-twister' ? old : entry));
    const requested: RequestedEvent[] = [
      { type: 'moved', entryId: 'e-heat' },
      { type: 'moved', entryId: 'e-twister' },
      { type: 'moved', entryId: 'nao-existe' },
      { type: 'commented', entryId: 'e-speed' },
      { type: 'commented', entryId: 'e-speed' },
    ];
    const valid = selectValidEvents(requested, list, noTitles, 'ana', now);
    assert.deepEqual(
      valid.map((item) => [item.type, item.type === 'removed' ? item.entryId : item.entry.entryId]),
      [['commented', 'e-speed']],
    );
  });

  test("'added' confere quem adicionou; os outros, quem atualizou por último", () => {
    const edited = entries.map((entry) => (entry.entryId === 'e-abyss' ? { ...entry, updatedBy: 'bia' } : entry));
    const valid = selectValidEvents(
      [
        { type: 'added', entryId: 'e-abyss' },
        { type: 'moved', entryId: 'e-abyss' },
      ],
      edited,
      noTitles,
      'ana',
      now,
    );
    assert.deepEqual(
      valid.map((item) => item.type),
      ['added'],
    );
  });
});

describe("evento 'removed'", () => {
  test('aceito só para entrada que não existe mais e filme guardado; o título vem do banco', () => {
    const titles = new Map([[603, 'The Matrix']]);
    const valid = selectValidEvents(
      [
        { type: 'removed', entryId: 'e-matrix', tmdbId: 603 },
        { type: 'removed', entryId: 'e-matrix', tmdbId: 603 },
        { type: 'removed', entryId: 'e-abyss', tmdbId: 2756 },
        { type: 'removed', entryId: 'e-sumiu', tmdbId: 999 },
      ],
      entries,
      titles,
      'ana',
      now,
    );
    assert.deepEqual(valid, [{ type: 'removed', entryId: 'e-matrix', tmdbId: 603, title: 'The Matrix' }]);
  });

  test('resumo: "retirou X da lista", abrindo o filme', () => {
    const removed: ValidEvent = { type: 'removed', entryId: 'e-matrix', tmdbId: 603, title: 'The Matrix' };
    assert.deepEqual(summarizeEvents('Debora', [removed], 3), {
      title: 'Debora retirou The Matrix da lista',
      body: undefined,
      quote: undefined,
      route: { name: 'movie', args: { tmdbId: 603 } },
    });
  });
});
