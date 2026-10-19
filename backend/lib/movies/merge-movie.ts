import { normalizeStreamingServices } from '../discover/streaming-names.js';
import { withoutUndefined } from '../firestore/without-undefined.js';
import { brazilDay } from '../time/brazil-day.js';
import type { FetchedSources, Movie } from '../types/movie.js';
import type { LetterboxdRating, OmdbRatings, TmdbMovie, TmdbMovieExtras } from '../types/sources.js';

/**
 * Junta o documento guardado com o que as fontes trouxeram agora. O que não veio continua como
 * estava, com a data em que foi buscado: atualizar só as notas preserva os campos extras, e
 * atualizar o TMDb preserva as notas, o Teste de Bechdel, os prêmios e a bilheteria da OMDb.
 * `extraFetchedAt` não muda aqui: quem busca todas as fontes extras (abertura do filme ou rotina
 * enrich) é quem grava a data.
 *
 * @param stored - Documento guardado, se existir.
 * @param fetched - O que cada fonte trouxe neste pedido.
 * @param now - Data a gravar nas fontes que vieram.
 * @returns O documento atualizado (sem alterar o guardado), sem chaves undefined.
 * @throws {Error} Se não houver documento guardado nem dados do TMDb, que dão título, ano e o id do IMDb.
 */
export function mergeMovie(stored: Movie | undefined, fetched: FetchedSources, now: Date): Movie {
  let movie = fetched.tmdb ? applyTmdb(stored, fetched.tmdb, now) : stored;
  if (!movie) throw new Error('mergeMovie: sem documento guardado, o TMDb é obrigatório');

  if (fetched.letterboxd) movie = applyLetterboxd(movie, fetched.letterboxd, now);
  if (fetched.omdb) movie = applyOmdb(movie, fetched.omdb, now);
  // O Firestore recusa campos undefined (campos extras que nunca foram buscados).
  return withoutUndefined(movie);
}

/**
 * Troca o catálogo inteiro pelo do TMDb, com os campos extras quando vieram, e mantém o que vem de
 * outras fontes: notas, endereço do Letterboxd, Teste de Bechdel, prêmios, bilheteria da OMDb e a
 * data dos campos extras.
 *
 * @param stored - Documento guardado, se existir.
 * @param tmdb - Filme vindo do TMDb.
 * @param now - Data da busca.
 * @returns O documento com o catálogo novo.
 */
function applyTmdb(stored: Movie | undefined, tmdb: TmdbMovie, now: Date): Movie {
  return {
    // Primeiro o guardado, para os campos que o TMDb não traz (ou extras que não vieram) continuarem.
    ...stored,
    title: tmdb.title,
    year: tmdb.year,
    directors: tmdb.directors,
    cast: tmdb.cast,
    runtime: tmdb.runtime,
    genres: tmdb.genres,
    synopsis: tmdb.synopsis,
    posterPath: tmdb.posterPath,
    ids: { imdb: tmdb.imdbId, letterboxd: stored?.ids.letterboxd ?? null },
    ratings: stored?.ratings ?? {},
    tmdbFetchedAt: now,
    ...(tmdb.extras && applyTmdbExtras(stored, tmdb.extras, now)),
  };
}

/**
 * Campos extras do TMDb no formato de movies/{tmdbId}. Em `providersBR`, `previous` guarda os
 * serviços da última busca de um dia anterior (Brasília), para a notificação "Chegou no streaming"
 * comparar: uma segunda busca no mesmo dia (abertura do filme depois da rotina) não apaga a
 * diferença. Na primeira busca, `previous` é igual ao atual (nada chegou ainda).
 *
 * @param stored - Documento guardado, se existir.
 * @param extras - Campos extras vindos do TMDb.
 * @param now - Data da busca.
 * @returns Os campos a gravar.
 */
function applyTmdbExtras(stored: Movie | undefined, extras: TmdbMovieExtras, now: Date): Partial<Movie> {
  return {
    titlePt: extras.titlePt,
    tagline: extras.tagline,
    budget: extras.budget,
    revenue: extras.revenue,
    certBR: extras.certBR,
    streamingFirst: extras.streamingFirst,
    collection: extras.collection,
    keywords: extras.keywords,
    recs: extras.recs,
    recsInfo: extras.recsInfo,
    release: extras.release,
    providersBR: { flatrate: extras.providersBR, previous: previousProviders(stored, extras, now), fetchedAt: now },
    popularity: extras.popularity,
    vote: extras.vote,
    votes: extras.votes,
  };
}

/**
 * Serviços de streaming a guardar como `previous`: os da busca de um dia anterior.
 *
 * @param stored - Documento guardado, se existir.
 * @param extras - Campos extras vindos agora do TMDb.
 * @param now - Data da busca.
 * @returns O `previous` guardado, se a última busca foi hoje; senão, o atual guardado (ou o novo, na primeira busca).
 */
function previousProviders(stored: Movie | undefined, extras: TmdbMovieExtras, now: Date): string[] {
  const current = stored?.providersBR;
  if (!current) return extras.providersBR;
  // Os nomes guardados antes da normalização são normalizados também, para não parecer que chegou serviço novo.
  return normalizeStreamingServices(
    brazilDay(current.fetchedAt) === brazilDay(now) ? current.previous : current.flatrate,
  );
}

/**
 * Grava a nota do Letterboxd. O endereço da página só muda quando o Letterboxd devolve um.
 *
 * @param movie - Documento a atualizar.
 * @param letterboxd - Nota vinda do Letterboxd.
 * @param now - Data da busca.
 * @returns O documento com a nota nova.
 */
function applyLetterboxd(movie: Movie, letterboxd: LetterboxdRating, now: Date): Movie {
  return {
    ...movie,
    ids: { ...movie.ids, letterboxd: letterboxd.url ?? movie.ids.letterboxd },
    ratings: {
      ...movie.ratings,
      letterboxd: { value: letterboxd.value, count: letterboxd.count, fetchedAt: now },
    },
  };
}

/**
 * Grava as três notas que a OMDb traz juntas (IMDb, Rotten Tomatoes e Metacritic), a bilheteria nos
 * EUA e, se os prêmios já existem, o resumo de prêmios em português. Sem prêmios guardados, o resumo
 * fica para a rotina enrich, que grava os prêmios inteiros.
 *
 * @param movie - Documento a atualizar.
 * @param omdb - Notas vindas da OMDb.
 * @param now - Data da busca.
 * @returns O documento com as notas novas.
 */
function applyOmdb(movie: Movie, omdb: OmdbRatings, now: Date): Movie {
  const { awardsSummary, boxOfficeUS } = omdb;
  return {
    ...movie,
    ratings: {
      ...movie.ratings,
      imdb: { ...omdb.imdb, fetchedAt: now },
      rottenTomatoes: { ...omdb.rottenTomatoes, fetchedAt: now },
      metacritic: { ...omdb.metacritic, fetchedAt: now },
    },
    ...(boxOfficeUS !== undefined && { boxOfficeUS }),
    ...(awardsSummary !== undefined && movie.awards && { awards: { ...movie.awards, summary: awardsSummary } }),
  };
}
