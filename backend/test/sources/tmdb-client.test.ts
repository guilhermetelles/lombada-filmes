import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { NotFoundError, SourceUnavailableError } from '../../lib/errors/app-errors.js';
import type { TmdbVideo } from '../../lib/schemas/sources/tmdb.js';
import { createTmdbClient } from '../../lib/sources/tmdb/tmdb-client.js';
import { pickTrailer } from '../../lib/sources/tmdb/tmdb-mappers.js';
import type { Fetch } from '../../lib/types/sources.js';
import { fakeSources, respondWith } from '../support/fake-sources.js';

const tmdbClient = (fetch: Fetch = fakeSources().fetch) => createTmdbClient({ token: 'token', fetch });

describe('TMDb: getMovie', () => {
  test('título em inglês, gêneros e sinopse em português, diretor e id do IMDb', async () => {
    const movie = await tmdbClient().getMovie(2756);

    assert.equal(movie.title, 'The Abyss');
    assert.equal(movie.year, 1989);
    assert.equal(movie.runtime, 138);
    assert.deepEqual(movie.directors, [
      { id: 2710, name: 'James Cameron', profilePath: '/9NAZnTjBQ9WcXAQEzZpKy4vdQto.jpg' },
    ]);
    assert.deepEqual(movie.genres, ['Aventura', 'Thriller', 'Ficção científica']);
    assert.equal(movie.imdbId, 'tt0096754');
    assert.match(movie.posterPath ?? '', /^\/.+\.jpg$/);
    assert.ok(movie.synopsis.pt && movie.synopsis.en);
    assert.notEqual(movie.synopsis.pt, movie.synopsis.en);
  });

  test('campos extras: título e slogan no Brasil, dinheiro, classificação, palavras-chave, parecidos e streaming', async () => {
    const extras = (await tmdbClient().getMovie(2756)).extras;

    assert.equal(extras?.titlePt, 'O Segredo do Abismo');
    assert.match(extras?.tagline ?? '', /O Segredo do Abismo/);
    assert.equal(extras?.budget, 43_000_000);
    assert.equal(extras?.revenue, 90_000_098);
    assert.equal(extras?.certBR, 'L');
    assert.equal(extras?.streamingFirst, false);
    assert.equal(extras?.collection, null);
    assert.equal(extras?.keywords.length, 20);
    assert.ok(extras?.keywords.includes('submarine'));
    // A gravação tem 12 recomendações; ficam as 10 primeiras.
    assert.deepEqual(extras?.recs, [14372, 10153, 1323244, 846, 33518, 169, 1141182, 507441, 600836, 8836]);
    assert.deepEqual(extras?.providersBR, ['Disney Plus']);
    assert.equal(extras?.votes, 3631);
    assert.ok((extras?.vote ?? 0) > 7 && (extras?.popularity ?? 0) > 0);
  });

  test('imagem horizontal e trailer: o oficial mais recente no YouTube, entre os vídeos gravados', async () => {
    const extras = (await tmdbClient().getMovie(2756)).extras;

    assert.equal(extras?.backdropPath, '/mW6XzxelLY8T2oW2NjciG9LpZT5.jpg');
    assert.deepEqual(extras?.trailer, {
      key: '7cCVYAcIIAo',
      name: '4K Remastered Official Trailer',
      lang: 'en',
      published: '2023-11-13',
    });
  });

  test('lançado direto em streaming: digital em 20+ países e cinema em até 2; sem release_dates, null', async () => {
    const countries = (type: number, count: number, offset = 0) =>
      Array.from({ length: count }, (_, index) => ({
        iso_3166_1: `P${index + offset}`,
        release_dates: [{ certification: '', type }],
      }));
    const streaming = {
      id: 1,
      title: 'Filme',
      release_dates: { results: [...countries(4, 232), ...countries(3, 1, 500)] },
    };
    const theatrical = {
      id: 2,
      title: 'Filme',
      release_dates: { results: [...countries(3, 11), ...countries(4, 2, 500)] },
    };
    assert.equal((await tmdbClient(respondWith(streaming)).getMovie(1)).extras?.streamingFirst, true);
    assert.equal((await tmdbClient(respondWith(theatrical)).getMovie(2)).extras?.streamingFirst, false);
    assert.equal((await tmdbClient(respondWith({ id: 3, title: 'Filme' })).getMovie(3)).extras?.streamingFirst, null);
  });

  test('campos extras: 0 vira null, palavras-chave cortadas em 25, saga e sem votos', async () => {
    const response = {
      id: 1,
      title: 'Filme',
      budget: 0,
      revenue: 0,
      vote_count: 0,
      vote_average: 0,
      belongs_to_collection: { id: 9, name: 'Coleção', poster_path: '/x.jpg' },
      keywords: { keywords: Array.from({ length: 30 }, (_, index) => ({ id: index, name: `k${index}` })) },
      release_dates: {
        results: [{ iso_3166_1: 'BR', release_dates: [{ certification: '' }, { certification: '14' }] }],
      },
    };
    const extras = (await tmdbClient(respondWith(response)).getMovie(1)).extras;

    assert.equal(extras?.budget, null);
    assert.equal(extras?.revenue, null);
    assert.equal(extras?.vote, null);
    assert.deepEqual(extras?.collection, { id: 9, name: 'Coleção' });
    assert.equal(extras?.keywords.length, 25);
    assert.equal(extras?.certBR, '14');
    assert.deepEqual(extras?.providersBR, []);
    assert.deepEqual(extras?.recs, []);
    assert.deepEqual(extras?.recsInfo, []);
    assert.equal(extras?.release, null);
  });

  test('data de estreia e resumo das recomendações, com os mesmos ids de recs', async () => {
    const extras = (await tmdbClient().getMovie(2756)).extras;

    assert.equal(extras?.release, '1989-08-09');
    assert.deepEqual(
      extras?.recsInfo.map((info) => info.tmdbId),
      extras?.recs,
    );
    assert.equal(extras?.recsInfo[0]?.title, 'Leviathan');
  });

  test('resumo das recomendações: título, ano e pôster; data fora do formato vira null', async () => {
    const response = {
      id: 1,
      title: 'Filme',
      release_date: '1989-13-40',
      recommendations: {
        results: [
          { id: 2, title: 'Parecido', release_date: '1990-03-02', poster_path: '/p.jpg' },
          { id: 3, original_title: 'Original', release_date: '', poster_path: null },
          {
            id: 4,
            title: 'O Segredo do Abismo',
            original_title: 'The Abyss',
            original_language: 'en',
            release_date: '1989-08-09',
            poster_path: null,
          },
          { id: 5, title: 'Amélie', original_title: 'Le Fabuleux Destin', original_language: 'fr', poster_path: null },
        ],
      },
    };
    const movie = await tmdbClient(respondWith(response)).getMovie(1);

    assert.equal(movie.year, 1989);
    assert.equal(movie.extras?.release, null);
    // titleEn só quando o idioma original é inglês: as recomendações não trazem a tradução.
    assert.deepEqual(movie.extras?.recsInfo, [
      { tmdbId: 2, title: 'Parecido', year: 1990, posterPath: '/p.jpg' },
      { tmdbId: 3, title: 'Original', year: null, posterPath: null },
      { tmdbId: 4, title: 'O Segredo do Abismo', titleEn: 'The Abyss', year: 1989, posterPath: null },
      { tmdbId: 5, title: 'Amélie', year: null, posterPath: null },
    ]);
  });

  test('streaming no Brasil com nomes normalizados: sem planos repetidos nem canal do serviço que já está', async () => {
    const provider = (provider_name: string, provider_id: number) => ({ provider_name, provider_id });
    const response = {
      id: 1,
      title: 'Filme',
      'watch/providers': {
        results: {
          BR: {
            flatrate: [
              provider('Paramount Plus', 531),
              provider('Paramount+ Amazon Channel', 582),
              provider('HBO Max Amazon Channel', 1825),
              provider('Netflix basic with Ads', 1796),
            ],
          },
        },
      },
    };
    const movie = await tmdbClient(respondWith(response)).getMovie(1);
    assert.deepEqual(movie.extras?.providersBR, ['Paramount Plus', 'HBO Max Amazon Channel', 'Netflix']);
  });

  test('pede os campos extras na mesma chamada', async () => {
    const urls: string[] = [];
    const sources = fakeSources();
    const recording: Fetch = async (input, init) => {
      urls.push(String(input));
      return sources.fetch(input, init);
    };
    await tmdbClient(recording).getMovie(2756);

    assert.equal(urls.length, 1);
    const append = new URL(urls[0] ?? '').searchParams.get('append_to_response');
    assert.equal(
      append,
      'credits,external_ids,translations,keywords,recommendations,watch/providers,release_dates,videos',
    );
    assert.equal(new URL(urls[0] ?? '').searchParams.get('include_video_language'), 'pt,en,null');
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

describe('TMDb: getCollection', () => {
  test('pede /collection/{id} em pt-BR e devolve os filmes com a data de estreia', async () => {
    const urls: string[] = [];
    const response = {
      id: 50,
      name: 'Saga',
      parts: [
        { id: 2, title: 'Segundo', release_date: '1981-05-01' },
        { id: 3, original_title: 'Terceiro', release_date: '' },
      ],
    };
    const recording: Fetch = async (input, init) => {
      urls.push(String(input));
      return respondWith(response)(input, init);
    };
    const collection = await tmdbClient(recording).getCollection(50);

    const url = new URL(urls[0] ?? '');
    assert.equal(url.pathname, '/3/collection/50');
    assert.equal(url.searchParams.get('language'), 'pt-BR');
    assert.deepEqual(collection, {
      id: 50,
      name: 'Saga',
      parts: [
        { tmdbId: 2, title: 'Segundo', release: '1981-05-01' },
        { tmdbId: 3, title: 'Terceiro', release: null },
      ],
    });
  });

  test('coleção inexistente: NotFoundError; fora do formato: SourceUnavailableError', async () => {
    await assert.rejects(tmdbClient(respondWith('{}', { status: 404 })).getCollection(1), NotFoundError);
    await assert.rejects(tmdbClient(respondWith({ id: 1 })).getCollection(1), SourceUnavailableError);
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

  test('pt-BR por padrão; en-US quando pedido', async () => {
    const urls: string[] = [];
    const recording: Fetch = async (input) => {
      urls.push(String(input));
      return new Response(JSON.stringify({ results: [] }));
    };
    await tmdbClient(recording).search('abismo');
    await tmdbClient(recording).search('abyss', 'en-US');
    assert.deepEqual(
      urls.map((url) => new URL(url).searchParams.get('language')),
      ['pt-BR', 'en-US'],
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
      crew: [{ id: 3, name: 'Diretora', job: 'Director', profile_path: null }],
      cast: [
        { id: 1, name: 'Ator', character: 'Papel A', order: 0, profile_path: null },
        { id: 1, name: 'Ator', character: 'Papel B', order: 1, profile_path: null },
        { id: 2, name: 'Atriz', character: '', order: 2, profile_path: '/a.jpg' },
      ],
    };
    const movie = await tmdbClient(respondWith({ id: 1, credits })).getMovie(1);

    assert.deepEqual(movie.cast, [
      { id: 1, name: 'Ator', character: 'Papel A', profilePath: null },
      { id: 2, name: 'Atriz', character: null, profilePath: '/a.jpg' },
    ]);
    assert.deepEqual(movie.directors, [{ id: 3, name: 'Diretora', profilePath: null }]);
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

describe('pickTrailer', () => {
  const video = (key: string, extra: Partial<TmdbVideo> = {}): TmdbVideo => ({
    key,
    name: key,
    site: 'YouTube',
    type: 'Trailer',
    official: true,
    iso_639_1: 'en',
    published_at: '2020-01-01T00:00:00.000Z',
    ...extra,
  });

  test('prefere o oficial, depois o português, depois o mais recente', () => {
    assert.equal(pickTrailer([video('a', { official: false, iso_639_1: 'pt' }), video('b')])?.key, 'b');
    assert.equal(pickTrailer([video('en'), video('pt', { iso_639_1: 'pt' })])?.key, 'pt');
    assert.equal(
      pickTrailer([video('velho'), video('novo', { published_at: '2023-11-13T17:00:00.000Z' })])?.key,
      'novo',
    );
  });

  test('ignora o que não é trailer do YouTube; sem nenhum, null', () => {
    assert.equal(pickTrailer([video('t', { type: 'Teaser' }), video('v', { site: 'Vimeo' })]), null);
    assert.equal(pickTrailer([]), null);
  });
});
