import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { NotFoundError, SourceUnavailableError } from '../../lib/errors/app-errors.js';
import { createTmdbClient } from '../../lib/sources/tmdb/tmdb-client.js';
import type { Fetch } from '../../lib/types/sources.js';
import { fakeSources, respondWith } from '../support/fake-sources.js';

const tmdbClient = (fetch: Fetch = fakeSources().fetch) => createTmdbClient({ token: 'token', fetch });

describe('TMDb: getMovie', () => {
  test('título em inglês, gêneros e sinopse em português, diretor e id do IMDb', async () => {
    const movie = await tmdbClient().getMovie(2756);

    assert.equal(movie.title, 'The Abyss');
    assert.equal(movie.year, 1989);
    assert.equal(movie.runtime, 138);
    assert.deepEqual(movie.directors, [{ id: 2710, name: 'James Cameron' }]);
    assert.deepEqual(movie.genres, ['Aventura', 'Thriller', 'Ficção científica']);
    assert.equal(movie.imdbId, 'tt0096754');
    assert.match(movie.posterPath ?? '', /^\/.+\.jpg$/);
    assert.ok(movie.synopsis.pt && movie.synopsis.en);
    assert.notEqual(movie.synopsis.pt, movie.synopsis.en);
  });

  test('sem tradução em inglês, usa o título original', async () => {
    const response = { id: 1, original_title: 'Katakuri-ke no kōfuku', title: 'A Felicidade dos Katakuris' };
    const movie = await tmdbClient(respondWith(response)).getMovie(1);

    assert.equal(movie.title, 'Katakuri-ke no kōfuku');
    assert.equal(movie.year, null);
    assert.equal(movie.imdbId, null);
  });

  test('filme inexistente: NotFoundError', async () => {
    await assert.rejects(tmdbClient().getMovie(99999999), NotFoundError);
  });

  test('fonte fora do ar, resposta que não é JSON ou fora do formato: SourceUnavailableError', async () => {
    await assert.rejects(tmdbClient(respondWith('fora do ar', { status: 503 })).getMovie(2756), SourceUnavailableError);
    await assert.rejects(tmdbClient(respondWith('<html>')).getMovie(2756), SourceUnavailableError);
    await assert.rejects(tmdbClient(respondWith({ id: 'texto' })).getMovie(2756), SourceUnavailableError);
  });

  test('falha de rede: SourceUnavailableError', async () => {
    const offline: Fetch = async () => {
      throw new TypeError('fetch failed');
    };
    await assert.rejects(tmdbClient(offline).getMovie(2756), SourceUnavailableError);
  });
});

describe('TMDb: search', () => {
  test('devolve o resumo de cada resultado, com o título em português', async () => {
    const results = await tmdbClient().search('abismo');
    const abyss = results.find((result) => result.tmdbId === 2756);

    assert.deepEqual(
      { title: abyss?.title, originalTitle: abyss?.originalTitle, year: abyss?.year },
      { title: 'O Segredo do Abismo', originalTitle: 'The Abyss', year: 1989 },
    );
  });

  test('a sinopse vira um trecho de até 200 caracteres', async () => {
    const response = { results: [{ id: 1, title: 'Longo', overview: 'palavra '.repeat(100) }] };
    const [result] = await tmdbClient(respondWith(response)).search('longo');

    assert.equal(result?.overview?.length, 200);
    assert.ok(result?.overview?.endsWith('…'));
  });
});

describe('TMDb: getPerson', () => {
  test('James Cameron: biografia em português, nascimento, foto e filmes que dirigiu', async () => {
    const person = await tmdbClient().getPerson(2710);

    assert.equal(person.name, 'James Cameron');
    assert.equal(person.birthday, '1954-08-16');
    assert.equal(person.deathday, null);
    assert.equal(person.placeOfBirth, 'Kapuskasing, Ontario, Canada');
    assert.equal(person.bioLang, 'pt');
    assert.match(person.biography ?? '', /\S/);
    assert.match(person.profilePath ?? '', /^\/.+\.jpg$/);
    assert.equal(person.imdbId, 'nm0000116');
  });

  test('filmes dirigidos: só o cargo Director, sem repetição, os 12 mais populares em inglês', async () => {
    const person = await tmdbClient().getPerson(2710);

    assert.equal(person.directedCount, 21);
    assert.equal(person.directed.length, 12);
    assert.deepEqual(person.directed[0], { tmdbId: 83533, title: 'Avatar: Fire and Ash', year: 2025 });
    assert.ok(person.directed.some((movie) => movie.title === 'The Terminator' && movie.year === 1984));
  });

  test('sem biografia em português, usa a inglesa; sem nenhuma, fica null', async () => {
    const english = await tmdbClient(respondWith({ id: 1, name: 'Fulana', biography: 'Born in…' })).getPerson(1);
    assert.deepEqual([english.biography, english.bioLang], ['Born in…', 'en']);

    const none = await tmdbClient(respondWith({ id: 1, name: 'Fulana', biography: '' })).getPerson(1);
    assert.deepEqual([none.biography, none.bioLang, none.directedCount], [null, null, 0]);
  });

  test('pessoa inexistente: NotFoundError', async () => {
    await assert.rejects(tmdbClient().getPerson(99999999), NotFoundError);
  });
});

describe('TMDb: elenco', () => {
  test('getMovie traz os 12 primeiros dos créditos, na ordem, com personagem e foto', async () => {
    const { cast } = await tmdbClient().getMovie(2756);

    assert.equal(cast.length, 12);
    assert.deepEqual(
      { id: cast[0]?.id, name: cast[0]?.name, character: cast[0]?.character },
      { id: 228, name: 'Ed Harris', character: "Virgil 'Bud' Brigman" },
    );
    assert.equal(cast[1]?.name, 'Mary Elizabeth Mastrantonio');
    assert.ok(cast.some((member) => member.id === 2712 && member.name === 'Michael Biehn'));
  });

  test('sem foto, profilePath fica null; quem tem dois papéis aparece uma vez', async () => {
    const credits = {
      cast: [
        { id: 1, name: 'Ator', character: 'Papel A', order: 0, profile_path: null },
        { id: 1, name: 'Ator', character: 'Papel B', order: 1, profile_path: null },
        { id: 2, name: 'Atriz', character: '', order: 2, profile_path: '/a.jpg' },
      ],
    };
    const movie = await tmdbClient(respondWith({ id: 1, credits: { crew: [], ...credits } })).getMovie(1);

    assert.deepEqual(movie.cast, [
      { id: 1, name: 'Ator', character: 'Papel A', profilePath: null },
      { id: 2, name: 'Atriz', character: null, profilePath: '/a.jpg' },
    ]);
  });

  test('getPerson de um ator: os 20 filmes mais votados, com personagem', async () => {
    const biehn = await tmdbClient().getPerson(2712);
    const titles = biehn.acted.map((movie) => movie.title);

    assert.equal(biehn.name, 'Michael Biehn');
    assert.equal(biehn.actedCount, 101);
    assert.equal(biehn.acted.length, 20);
    assert.ok(titles.includes('The Abyss') && titles.includes('Aliens'));
    assert.ok(biehn.acted.find((movie) => movie.title === 'Aliens')?.character);
  });

  test('papéis só com imagens de arquivo não contam como atuação', async () => {
    const cameron = await tmdbClient().getPerson(2710);
    assert.equal(cameron.actedCount, 83);
    assert.ok(cameron.acted.every((movie) => !/archive footage/i.test(movie.character ?? '')));
  });
});

describe('TMDb: searchPeople', () => {
  test('"cameron": só quem atua ou dirige, até 5, com James Cameron como direção', async () => {
    const people = await tmdbClient().searchPeople('cameron');

    assert.equal(people.length, 5);
    assert.ok(people.every((person) => person.department === 'acting' || person.department === 'directing'));
    const james = people.find((person) => person.personId === 2710);
    assert.equal(james?.department, 'directing');
    assert.ok((james?.knownFor.length ?? 0) > 0 && (james?.knownFor.length ?? 0) <= 3);
  });

  test('"ed harris": o ator vem primeiro, e os homônimos de efeitos, arte e edição ficam de fora', async () => {
    const people = await tmdbClient().searchPeople('ed harris');

    assert.deepEqual(
      { personId: people[0]?.personId, name: people[0]?.name, department: people[0]?.department },
      { personId: 228, name: 'Ed Harris', department: 'acting' },
    );
    assert.ok(people.every((person) => person.personId !== 6210476));
  });

  test('títulos conhecidos aceitam séries (name) e param em 3', async () => {
    const response = {
      results: [
        {
          id: 1,
          name: 'Atriz',
          known_for_department: 'Acting',
          profile_path: null,
          known_for: [{ name: 'Série' }, { title: 'Filme 1' }, { title: 'Filme 2' }, { title: 'Filme 3' }],
        },
      ],
    };
    const [person] = await tmdbClient(respondWith(response)).searchPeople('atriz');
    assert.deepEqual(person?.knownFor, ['Série', 'Filme 1', 'Filme 2']);
    assert.equal(person?.profilePath, null);
  });
});
