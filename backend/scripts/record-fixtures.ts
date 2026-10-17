/**
 * Grava respostas reais das fontes em test/fixtures/, para os testes rodarem sem rede.
 * Uso: npm run record:fixtures (lê TMDB_TOKEN e OMDB_KEY do .env da raiz).
 * As respostas são enxugadas ao que o código lê; nenhuma delas contém as chaves.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import type * as z from 'zod';
import { readEnv } from '../lib/config/env.js';
import {
  TmdbCreditsToRecord,
  TmdbDetailsToRecord,
  TmdbPersonSearchToRecord,
  TmdbPersonToRecord,
  TmdbSearchToRecord,
} from '../lib/schemas/fixtures.js';
import { LETTERBOXD_USER_AGENT } from '../lib/sources/letterboxd/letterboxd-client.js';

process.loadEnvFile(new URL('../../.env', import.meta.url));
const env = readEnv();
const dir = new URL('../test/fixtures/', import.meta.url);
mkdirSync(dir, { recursive: true });
const save = (name: string, body: unknown) =>
  writeFileSync(new URL(name, dir), typeof body === 'string' ? body : `${JSON.stringify(body, null, 1)}\n`);

const tmdb = async <T extends z.ZodType>(path: string, schema: T) => {
  const response = await fetch(`https://api.themoviedb.org/3${path}`, {
    headers: { authorization: `Bearer ${env.TMDB_TOKEN}` },
  });
  return schema.parse(await response.json());
};

const details = await tmdb(
  '/movie/2756?language=pt-BR&append_to_response=credits,external_ids,translations',
  TmdbDetailsToRecord,
);
save('tmdb-movie-2756.json', {
  ...details,
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

const credits = await tmdb('/movie/2756/credits', TmdbCreditsToRecord);
save('tmdb-credits-2756.json', {
  ...credits,
  crew: [],
  cast: [...credits.cast].sort((a, b) => a.order - b.order).slice(0, 15),
});

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
    translations: actor.translations.translations.filter((translation) => ['pt', 'en'].includes(translation.iso_639_1)),
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

const omdb = await fetch(
  `https://www.omdbapi.com/?${new URLSearchParams({ i: 'tt0096754', tomatoes: 'true', apikey: env.OMDB_KEY })}`,
);
save('omdb-tt0096754.json', await omdb.json());

const page = await fetch('https://letterboxd.com/tmdb/2756/', { headers: { 'user-agent': LETTERBOXD_USER_AGENT } });
const jsonLd = /<script type="application\/ld\+json">[\s\S]*?<\/script>/.exec(await page.text())?.[0];
if (!jsonLd) throw new Error('página do Letterboxd sem JSON-LD');
save('letterboxd-2756.html', `<!DOCTYPE html><html><head>${jsonLd}</head><body></body></html>\n`);

console.log('fixtures gravadas em test/fixtures/');
