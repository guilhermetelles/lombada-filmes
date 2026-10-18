import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { mergeMovie } from '../../lib/movies/merge-movie.js';
import { letterboxdAbyss, omdbAbyss, tmdbAbyss } from '../support/movie-samples.js';

const firstDay = new Date('2026-10-01T12:00:00Z');
const nextDay = new Date('2026-10-02T12:00:00Z');
const storedAbyss = () =>
  mergeMovie(undefined, { tmdb: tmdbAbyss, letterboxd: letterboxdAbyss, omdb: omdbAbyss }, firstDay);

describe('mergeMovie', () => {
  test('primeira vez: monta o documento com as três fontes', () => {
    const movie = storedAbyss();

    assert.equal(movie.title, 'The Abyss');
    assert.deepEqual(movie.ids, { imdb: 'tt0096754', letterboxd: 'https://letterboxd.com/film/the-abyss/' });
    assert.deepEqual(movie.ratings.letterboxd, { value: 3.72, count: 174_000, fetchedAt: firstDay });
    assert.deepEqual(movie.ratings.imdb, { value: 7.5, votes: 211_000, fetchedAt: firstDay });
    assert.deepEqual(movie.ratings.metacritic, { value: 62, fetchedAt: firstDay });
    assert.equal(movie.tmdbFetchedAt, firstDay);
  });

  test('só a fonte que veio é atualizada; as outras mantêm o valor e a data', () => {
    const movie = mergeMovie(storedAbyss(), { letterboxd: { ...letterboxdAbyss, value: 3.8 } }, nextDay);

    assert.deepEqual(movie.ratings.letterboxd, { value: 3.8, count: 174_000, fetchedAt: nextDay });
    assert.deepEqual(movie.ratings.imdb, { value: 7.5, votes: 211_000, fetchedAt: firstDay });
    assert.equal(movie.tmdbFetchedAt, firstDay);
  });

  test('TMDb novo troca o catálogo e mantém as notas e o endereço do Letterboxd', () => {
    const movie = mergeMovie(storedAbyss(), { tmdb: { ...tmdbAbyss, title: 'The Abyss (Special Edition)' } }, nextDay);

    assert.equal(movie.title, 'The Abyss (Special Edition)');
    assert.equal(movie.ids.letterboxd, letterboxdAbyss.url);
    assert.equal(movie.ratings.letterboxd?.value, 3.72);
    assert.equal(movie.tmdbFetchedAt, nextDay);
  });

  test('Letterboxd sem o filme mantém o endereço guardado e grava a nota vazia com a data', () => {
    const movie = mergeMovie(storedAbyss(), { letterboxd: { value: null, count: null, url: null } }, nextDay);

    assert.equal(movie.ids.letterboxd, letterboxdAbyss.url);
    assert.deepEqual(movie.ratings.letterboxd, { value: null, count: null, fetchedAt: nextDay });
  });

  test('o elenco vem do TMDb e se mantém quando só as notas são atualizadas', () => {
    const movie = mergeMovie(storedAbyss(), { letterboxd: letterboxdAbyss }, nextDay);
    assert.deepEqual(movie.cast, tmdbAbyss.cast);
  });

  test('sem documento guardado, o TMDb é obrigatório', () => {
    assert.throws(() => mergeMovie(undefined, { letterboxd: letterboxdAbyss }, firstDay), /TMDb é obrigatório/);
  });
});

describe('mergeMovie: campos extras', () => {
  const extras = {
    titlePt: 'O Segredo do Abismo',
    tagline: 'Slogan',
    budget: 43_000_000,
    revenue: 90_000_098,
    certBR: 'L',
    collection: null,
    keywords: ['submarine'],
    recs: [14372],
    recsInfo: [{ tmdbId: 14372, title: 'Leviathan', year: 1989, posterPath: null }],
    release: '1989-08-09',
    providersBR: ['Disney Plus'],
    popularity: 16.2,
    vote: 7.4,
    votes: 3631,
  };
  const tmdbWithExtras = { ...tmdbAbyss, extras };
  const awards = { items: [{ org: 'Oscar', cat: 'melhores efeitos visuais', kind: 'win' as const, year: 1990 }] };
  const enriched = () => ({
    ...mergeMovie(undefined, { tmdb: tmdbWithExtras, omdb: omdbAbyss }, firstDay),
    extraFetchedAt: firstDay,
    awards: { ...awards, summary: 'Ganhou 1 Oscar', fetchedAt: firstDay },
  });

  test('o TMDb grava os campos extras; na primeira vez, previous é igual ao atual', () => {
    const movie = mergeMovie(undefined, { tmdb: tmdbWithExtras }, firstDay);

    assert.equal(movie.titlePt, 'O Segredo do Abismo');
    assert.deepEqual(movie.keywords, ['submarine']);
    assert.deepEqual(movie.recs, [14372]);
    assert.deepEqual(movie.recsInfo, [{ tmdbId: 14372, title: 'Leviathan', year: 1989, posterPath: null }]);
    assert.equal(movie.release, '1989-08-09');
    assert.equal(movie.collection, null);
    assert.deepEqual(movie.providersBR, { flatrate: ['Disney Plus'], previous: ['Disney Plus'], fetchedAt: firstDay });
    assert.equal('extraFetchedAt' in movie, false);
  });

  test('atualizar só as notas preserva os campos extras, os prêmios e extraFetchedAt', () => {
    const before = enriched();
    const movie = mergeMovie(before, { letterboxd: letterboxdAbyss }, nextDay);

    for (const field of [
      'titlePt',
      'keywords',
      'recs',
      'recsInfo',
      'release',
      'providersBR',
      'awards',
      'extraFetchedAt',
      'popularity',
    ] as const) {
      assert.deepEqual(movie[field], before[field], field);
    }
  });

  test('TMDb novo mantém prêmios, bilheteria da OMDb e extraFetchedAt; previous guarda a busca do dia anterior', () => {
    const before = { ...enriched(), boxOfficeUS: 54_981_151 };
    const movie = mergeMovie(
      before,
      { tmdb: { ...tmdbWithExtras, extras: { ...extras, providersBR: ['Netflix'] } } },
      nextDay,
    );

    assert.deepEqual(movie.awards, before.awards);
    assert.equal(movie.boxOfficeUS, 54_981_151);
    assert.equal(movie.extraFetchedAt, firstDay);
    assert.deepEqual(movie.providersBR, { flatrate: ['Netflix'], previous: ['Disney Plus'], fetchedAt: nextDay });
  });

  test('segunda busca do TMDb no mesmo dia não apaga a diferença de onde assistir', () => {
    const changed = mergeMovie(
      enriched(),
      { tmdb: { ...tmdbWithExtras, extras: { ...extras, providersBR: ['Netflix'] } } },
      nextDay,
    );
    const laterSameDay = new Date(nextDay.getTime() + 60 * 60 * 1000);
    const again = mergeMovie(
      changed,
      { tmdb: { ...tmdbWithExtras, extras: { ...extras, providersBR: ['Netflix'] } } },
      laterSameDay,
    );

    assert.deepEqual(again.providersBR?.previous, ['Disney Plus']);
    assert.deepEqual(again.providersBR?.flatrate, ['Netflix']);
  });

  test('TMDb sem campos extras (dados montados à mão) mantém os guardados', () => {
    const before = enriched();
    const movie = mergeMovie(before, { tmdb: tmdbAbyss }, nextDay);
    assert.deepEqual(movie.keywords, before.keywords);
    assert.deepEqual(movie.recsInfo, before.recsInfo);
    assert.equal(movie.release, '1989-08-09');
    assert.deepEqual(movie.providersBR, before.providersBR);
  });

  test('a OMDb grava a bilheteria e atualiza o resumo só se os prêmios já existem', () => {
    const omdb = {
      ...omdbAbyss,
      awardsSummary: 'Ganhou 1 Oscar. 9 prêmios e 16 indicações no total',
      boxOfficeUS: 54_981_151,
    };

    const withAwards = mergeMovie(enriched(), { omdb }, nextDay);
    assert.equal(withAwards.boxOfficeUS, 54_981_151);
    assert.equal(withAwards.awards?.summary, omdb.awardsSummary);
    assert.equal(withAwards.awards?.fetchedAt, firstDay);

    const withoutAwards = mergeMovie(storedAbyss(), { omdb }, nextDay);
    assert.equal(withoutAwards.awards, undefined);
    assert.equal(withoutAwards.boxOfficeUS, 54_981_151);
  });

  test('o documento sai sem chaves undefined (o Firestore recusa)', () => {
    const movie = mergeMovie(undefined, { tmdb: tmdbAbyss }, firstDay);
    assert.ok(Object.values(movie).every((value) => value !== undefined));
  });
});

describe('mergeMovie: sem TMDb', () => {
  test('sem documento guardado, o TMDb continua obrigatório', () => {
    assert.throws(() => mergeMovie(undefined, { letterboxd: letterboxdAbyss }, firstDay), /TMDb é obrigatório/);
  });
});
