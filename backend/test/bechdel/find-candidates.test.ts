import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { findCandidates } from '../../lib/bechdel/find-candidates.js';
import { normalizeTitle } from '../../lib/bechdel/normalize-title.js';
import { BechdelIndex } from '../../lib/schemas/sources/bechdel.js';
import type { BechdelIndexEntry } from '../../lib/types/sources.js';

/** Índice gravado em test/fixtures/ (npm run record:fixtures -- bechdel). */
const index = BechdelIndex.parse(
  JSON.parse(readFileSync(new URL('../fixtures/bechdel-index.json', import.meta.url), 'utf8')),
);

const siteIds = (title: string, year: number | null) =>
  findCandidates(index, { title, year }).map((entry) => entry.siteId);

/** Um filme do índice só com o necessário. */
const entry = (siteId: number, title: string, year: number): BechdelIndexEntry => ({
  siteId,
  title,
  year,
  rating: 3,
  dubious: false,
});

describe('normalizeTitle', () => {
  test('artigo do fim volta para o começo, sem acentos, "&" vira "and", só letras e números', () => {
    assert.equal(normalizeTitle('Abyss, The'), normalizeTitle('The Abyss'));
    assert.equal(normalizeTitle('Abyss, The'), 'the abyss');
    assert.equal(normalizeTitle("Bug's Life, A"), 'a bug s life');
    assert.equal(normalizeTitle('Pokémon: The First Movie'), 'pokemon the first movie');
    assert.equal(normalizeTitle('Pride & Prejudice'), normalizeTitle('Pride and Prejudice'));
    assert.equal(normalizeTitle('  Snatch. '), 'snatch');
  });
});

describe('findCandidates', () => {
  test('título com ", The" e mesmo ano', () => {
    assert.deepEqual(siteIds('The Abyss', 1989), [1478]);
  });

  test('ano com até 1 de diferença', () => {
    assert.deepEqual(siteIds('The Abyss', 1990), [1478]);
    assert.deepEqual(siteIds('The Abyss', 1988), [1478]);
  });

  test('homônimos: só o do ano certo', () => {
    assert.deepEqual(siteIds('Fantastic Four', 2005), [2541]);
    assert.deepEqual(siteIds('Fantastic Four', 2015), [6392]);
  });

  test('grafia diferente: uma letra a mais ou a menos', () => {
    assert.deepEqual(siteIds('Terminator 2: Judgment Day', 1991), [847]);
  });

  test('número escrito por extenso: "The Fantastic 4" é "Fantastic Four, The"', () => {
    assert.deepEqual(siteIds('The Fantastic 4: First Steps', 2025), [11925]);
  });

  test('título contido no outro: o mais parecido primeiro, e o do ano seguinte depois', () => {
    assert.deepEqual(siteIds('The Twilight Saga: New Moon', 2009), [780, 501]);
  });

  test('título igual com até 3 anos de diferença, só quando nada mais próximo aparece', () => {
    const cannibal = [entry(3921, 'Cannibal! The Musical', 1993)];
    assert.deepEqual(
      findCandidates(cannibal, { title: 'Cannibal! The Musical', year: 1996 }).map(({ siteId }) => siteId),
      [3921],
    );
    assert.deepEqual(findCandidates(cannibal, { title: 'Cannibal! The Musical', year: 1997 }), []);
    // Com um igual a 1 ano, o de 3 anos fica de fora.
    assert.deepEqual(siteIds('Fantastic Four', 2016), [6392]);
  });

  test('sem ano, sem candidato ou longe demais: vazio', () => {
    assert.deepEqual(siteIds('The Abyss', null), []);
    assert.deepEqual(siteIds('Caught Stealing', 2025), []);
    assert.deepEqual(siteIds('The Abyss', 1995), []);
  });

  test('título curto não casa por estar contido em outro', () => {
    const short = [entry(1, 'It', 2017), entry(2, 'It Follows', 2017)];
    assert.deepEqual(
      findCandidates(short, { title: 'It Chapter Two', year: 2017 }).map(({ siteId }) => siteId),
      [],
    );
  });
});
