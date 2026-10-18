/**
 * Grava respostas reais das fontes em test/fixtures/, para os testes rodarem sem rede.
 * Uso: npm run record:fixtures (lê TMDB_TOKEN e OMDB_KEY do .env da raiz). Para regravar só algumas
 * fontes, passe os nomes: npm run record:fixtures -- bechdel (tmdb, omdb, letterboxd, bechdel,
 * wikidata, wikipedia).
 * As respostas são enxugadas ao que o código lê; nenhuma delas contém as chaves.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import type * as z from 'zod';
import { readEnv } from '../lib/config/env.js';
import {
  BechdelIndexToRecord,
  TmdbDetailsToRecord,
  TmdbPersonSearchToRecord,
  TmdbPersonToRecord,
  TmdbSearchToRecord,
} from '../lib/schemas/fixtures.js';
import { TmdbExtrasToRecord } from '../lib/schemas/sources/fixtures.js';
import { BECHDEL_USER_AGENT } from '../lib/sources/bechdel/bechdel-client.js';
import { LETTERBOXD_USER_AGENT } from '../lib/sources/letterboxd/letterboxd-client.js';
import { buildAwardsQuery } from '../lib/sources/wikidata/awards-query.js';
import { WIKIMEDIA_USER_AGENT } from '../lib/sources/wikidata/wikidata-client.js';
import type { SourceName } from '../lib/types/sources.js';

process.loadEnvFile(new URL('../../.env', import.meta.url));
const env = readEnv();
const dir = new URL('../test/fixtures/', import.meta.url);
mkdirSync(dir, { recursive: true });
const chosen = new Set(process.argv.slice(2));
const records = (source: SourceName) => chosen.size === 0 || chosen.has(source);
const save = (name: string, body: unknown) =>
  writeFileSync(new URL(name, dir), typeof body === 'string' ? body : `${JSON.stringify(body, null, 1)}\n`);

const tmdb = async <T extends z.ZodType>(path: string, schema: T) => {
  const response = await fetch(`https://api.themoviedb.org/3${path}`, {
    headers: { authorization: `Bearer ${env.TMDB_TOKEN}` },
  });
  return schema.parse(await response.json());
};

if (records('tmdb')) {
  const append = 'credits,external_ids,translations,keywords,recommendations,watch/providers,release_dates';
  const details = await tmdb(`/movie/2756?language=pt-BR&append_to_response=${append}`, TmdbDetailsToRecord);
  const extras = TmdbExtrasToRecord.parse(details);
  save('tmdb-movie-2756.json', {
    ...details,
    // 12 recomendações para os testes conferirem o corte nas 10 primeiras; só id e título.
    recommendations: {
      results: extras.recommendations.results.slice(0, 12).map(({ id, title }) => ({ id, title })),
    },
    release_dates: {
      results: extras.release_dates.results.filter((result) => ['BR', 'US'].includes(result.iso_3166_1)),
    },
    'watch/providers': { results: { BR: extras['watch/providers'].results.BR ?? {} } },
    credits: {
      crew: details.credits.crew.filter((person) => person.job === 'Director'),
      // 15 para os testes conferirem o corte nos 12 primeiros.
      cast: [...details.credits.cast].sort((a, b) => a.order - b.order).slice(0, 15),
    },
    translations: {
      translations: details.translations.translations.filter((translation) => translation.iso_639_1 === 'en'),
    },
  });

  // Busca de pessoas: a resposta inteira da primeira página, com quem não atua nem dirige no meio.
  for (const [query, file] of [
    ['cameron', 'tmdb-search-person-cameron.json'],
    ['ed harris', 'tmdb-search-person-ed-harris.json'],
  ] as const) {
    const params = new URLSearchParams({ query, language: 'pt-BR', include_adult: 'false' });
    save(file, await tmdb(`/search/person?${params}`, TmdbPersonSearchToRecord));
  }

  const search = await tmdb('/search/movie?query=abismo&language=pt-BR&include_adult=false', TmdbSearchToRecord);
  // Os 3 primeiros e o The Abyss, que os testes procuram (a ordem do TMDb muda com o tempo).
  const abyssResult = search.results.find((result) => result.id === 2756);
  const topResults = search.results.slice(0, 3).filter((result) => result.id !== 2756);
  save('tmdb-search-abismo.json', { ...search, results: abyssResult ? [...topResults, abyssResult] : topResults });

  /** Michael Biehn: ator do The Abyss; os filmes atuados vêm inteiros. */
  const actor = await tmdb(
    '/person/2712?language=en-US&append_to_response=movie_credits,external_ids,translations',
    TmdbPersonToRecord,
  );
  save('tmdb-person-2712.json', {
    ...actor,
    movie_credits: { crew: [], cast: actor.movie_credits.cast },
    translations: {
      translations: actor.translations.translations.filter((translation) =>
        ['pt', 'en'].includes(translation.iso_639_1),
      ),
    },
  });

  /** James Cameron: os créditos de direção, mais um crédito de outro cargo para testar o filtro. */
  const person = await tmdb(
    '/person/2710?language=en-US&append_to_response=movie_credits,external_ids,translations',
    TmdbPersonToRecord,
  );
  const directing = person.movie_credits.crew.filter((credit) => credit.job === 'Director');
  const otherJob = person.movie_credits.crew.find((credit) => credit.job !== 'Director');
  save('tmdb-person-2710.json', {
    ...person,
    movie_credits: { crew: otherJob ? [...directing, otherJob] : directing, cast: person.movie_credits.cast },
    translations: {
      translations: person.translations.translations.filter((translation) =>
        ['pt', 'en'].includes(translation.iso_639_1),
      ),
    },
  });
}

if (records('omdb')) {
  const omdb = await fetch(
    `https://www.omdbapi.com/?${new URLSearchParams({ i: 'tt0096754', tomatoes: 'true', apikey: env.OMDB_KEY })}`,
  );
  save('omdb-tt0096754.json', await omdb.json());
}

if (records('letterboxd')) {
  const page = await fetch('https://letterboxd.com/tmdb/2756/', { headers: { 'user-agent': LETTERBOXD_USER_AGENT } });
  const jsonLd = /<script type="application\/ld\+json">[\s\S]*?<\/script>/.exec(await page.text())?.[0];
  if (!jsonLd) throw new Error('página do Letterboxd sem JSON-LD');
  save('letterboxd-2756.html', `<!DOCTYPE html><html><head>${jsonLd}</head><body></body></html>\n`);
}

if (records('bechdel')) {
  // O site é mantido por voluntários: três pedidos, um de cada vez.
  const bechdel = async (path: string) => {
    const response = await fetch(`https://bechdeltest.com${path}`, { headers: { 'user-agent': BECHDEL_USER_AGENT } });
    if (!response.ok) throw new Error(`bechdeltest.com${path} respondeu ${response.status}`);
    return response;
  };
  // The Abyss (1478, "Abyss, The"); dois "Fantastic Four" homônimos (2005 e 2015) e "Fantastic Four,
  // The" (1994); "Fantastic Four: First Steps, The" (o TMDb escreve "The Fantastic 4"); "Terminator 2:
  // Judgement Day" (o TMDb escreve "Judgment") e "Terminator, The"; "New Moon" (o TMDb escreve
  // "The Twilight Saga: New Moon") e "Twilight", do ano anterior.
  const kept = new Set([1478, 2541, 6392, 3162, 11925, 847, 1418, 780, 501]);
  const index = BechdelIndexToRecord.parse(await (await bechdel('/search/index.json')).json());
  save('bechdel-index.json', `${JSON.stringify(index.filter(([siteId]) => kept.has(siteId)))}\n`);
  save('bechdel-1478-redirect.html', await (await bechdel('/view/1478/')).text());
  save('bechdel-1478.html', await (await bechdel('/view/1478/the_abyss/')).text());
}

/** The Abyss, Breaking Dawn – Part 2 e One Battle After Another: os filmes conferidos no passo 13. */
const AWARD_MOVIES = [2756, 50620, 1054867];

/** James Cameron, Kristen Stewart e Robert Pattinson. */
const AWARD_PEOPLE = [2710, 37917, 11288];

/** Uma consulta SPARQL ao Wikidata, com a resposta inteira. */
const sparql = async (query: string) => {
  const response = await fetch(`https://query.wikidata.org/sparql?${new URLSearchParams({ query, format: 'json' })}`, {
    headers: { accept: 'application/sparql-results+json', 'user-agent': WIKIMEDIA_USER_AGENT },
  });
  if (!response.ok) throw new Error(`Wikidata respondeu ${response.status}`);
  return response.json();
};

if (records('wikidata')) {
  save('wikidata-movies.json', await sparql(buildAwardsQuery(AWARD_MOVIES, 'P4947', true)));
  save('wikidata-people.json', await sparql(buildAwardsQuery(AWARD_PEOPLE, 'P4985', false)));
}

if (records('wikipedia')) {
  // Os títulos dos artigos são os sitelinks que a consulta de filmes devolve.
  const titles = ['The Abyss', 'The Twilight Saga: Breaking Dawn – Part 2', 'One Battle After Another'];
  const params = new URLSearchParams({
    action: 'query',
    prop: 'categories',
    titles: titles.join('|'),
    cllimit: 'max',
    clshow: '!hidden',
    redirects: '1',
    format: 'json',
    formatversion: '2',
  });
  const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
    headers: { accept: 'application/json', 'user-agent': WIKIMEDIA_USER_AGENT },
  });
  if (!response.ok) throw new Error(`Wikipedia respondeu ${response.status}`);
  save('wikipedia-categories.json', await response.json());
}

console.log('fixtures gravadas em test/fixtures/');
