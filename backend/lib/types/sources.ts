import type { TmdbDiscoverClient } from '../discover/tmdb-discover-client.js';
/**
 * Fontes externas de dados de filmes e o que cada uma devolve, já no formato do app.
 * Quando a fonte não tem o filme, as notas vêm null: é uma resposta válida, que também vale 7 dias.
 */

import type * as z from 'zod';
import type { AwardItem } from './awards.js';
import type { MovieRecInfo } from './movie.js';
import type { CastMember, Director, Person, PersonDepartment } from './person.js';

/** Fontes externas, também usadas como chave do consumo em usage/{dia}. */
export type SourceName = 'tmdb' | 'omdb' | 'letterboxd' | 'bechdel' | 'wikidata' | 'wikipedia' | 'gemini';

/** Fontes com prazo de 7 dias por filme: o TMDb e as notas (as outras têm prazos próprios). */
export type WeeklySource = Extract<SourceName, 'tmdb' | 'omdb' | 'letterboxd'>;

/** Assinatura do fetch, injetado nos clientes (o global em produção, um falso nos testes). */
export type Fetch = typeof globalThis.fetch;

/** Sinopse em português e em inglês; null onde o TMDb não tem. */
export type Synopsis = { pt: string | null; en: string | null };

/** Filme como o TMDb descreve, já no formato do app. */
export type TmdbMovie = {
  title: string; // em inglês, como no Letterboxd e na lista original
  year: number | null;
  directors: Director[];
  cast: CastMember[]; // os 12 primeiros dos créditos
  runtime: number | null; // minutos
  genres: string[]; // em português
  synopsis: Synopsis;
  posterPath: string | null;
  imdbId: string | null;
  extras?: TmdbMovieExtras | undefined; // campos da versão 0.3; ausente só em dados montados à mão
};

/** Campos extras do filme no TMDb (curiosidades, parecidos, onde assistir), no formato de movies/{tmdbId}. */
export type TmdbMovieExtras = {
  titlePt: string | null; // título no Brasil
  tagline: string | null; // slogan em pt-BR
  budget: number | null; // US$; null quando o TMDb não sabe (0)
  revenue: number | null; // bilheteria mundial, US$; null quando o TMDb não sabe (0)
  certBR: string | null; // classificação indicativa no Brasil
  collection: { id: number; name: string } | null;
  keywords: string[]; // até 25, em inglês
  recs: number[]; // até 10 ids do TMDb
  recsInfo: MovieRecInfo[]; // os mesmos ids de recs, com título, ano e pôster
  release: string | null; // AAAA-MM-DD, release_date do TMDb
  providersBR: string[]; // streaming por assinatura no Brasil (flatrate)
  popularity: number;
  vote: number | null; // média do TMDb; null sem votos
  votes: number;
};

/** Um filme de uma coleção (saga) do TMDb. */
export type TmdbCollectionPart = {
  tmdbId: number;
  title: string;
  release: string | null; // AAAA-MM-DD; null quando o TMDb ainda não tem data
};

/** Coleção (saga) do TMDb com os filmes dela. */
export type TmdbCollection = {
  id: number;
  name: string;
  parts: TmdbCollectionPart[];
};

/** Um resultado da busca do TMDb, resumido para a lista de busca. */
export type TmdbSearchResult = {
  tmdbId: number;
  title: string; // em português quando o TMDb tem tradução
  originalTitle: string | null;
  year: number | null;
  posterPath: string | null;
  overview: string | null; // trecho de até 200 caracteres
};

/** Uma pessoa encontrada na busca do TMDb, resumida para a lista de resultados. */
export type TmdbPersonSearchResult = {
  personId: number;
  name: string;
  department: PersonDepartment; // acting abre a tela do ator; directing, a do diretor
  profilePath: string | null;
  knownFor: string[]; // até 3 títulos, em português quando há tradução; ajudam a diferenciar homônimos
};

/** Pessoa como o TMDb descreve, já no formato de people/{id} (sem a data da busca). */
export type TmdbPerson = Omit<Person, 'fetchedAt'>;

/** As três notas que a OMDb traz juntas. */
export type OmdbRatings = {
  imdb: { value: number | null; votes: number | null };
  rottenTomatoes: { value: number | null; url: string | null };
  metacritic: { value: number | null };
  awardsSummary?: string | null | undefined; // Awards da OMDb traduzido; null quando não há
  boxOfficeUS?: number | null | undefined; // BoxOffice da OMDb, US$
};

/** Nota do Letterboxd e o endereço da página do filme. */
export type LetterboxdRating = {
  value: number | null; // média de 0,5 a 5; null quando o filme ainda tem poucas notas
  count: number | null;
  url: string | null; // página do filme; null quando o Letterboxd não tem o filme
};

/** Um filme do índice do bechdeltest.com (/search/index.json). */
export type BechdelIndexEntry = {
  siteId: number;
  title: string; // no formato do site ("Abyss, The")
  year: number;
  rating: number; // quantos dos 3 critérios o filme passa
  dubious: boolean; // o site marca a avaliação como duvidosa
};

/** Página de um filme no bechdeltest.com, já lida. */
export type BechdelPage = {
  siteId: number;
  url: string; // endereço final da página, depois do redirecionamento
  imdbId: string | null; // para confirmar o casamento; null quando a página não traz o link
  rating: number;
  dubious: boolean;
  disputes: number; // comentários que contestam a avaliação
};

/** Cliente do TMDb: detalhes de filme, busca de filmes e de pessoas, detalhes de pessoa e coleções. */
export type TmdbClient = {
  getMovie(tmdbId: number): Promise<TmdbMovie>;
  getCollection(collectionId: number): Promise<TmdbCollection>;
  search(query: string): Promise<TmdbSearchResult[]>;
  getPerson(personId: number): Promise<TmdbPerson>;
  searchPeople(query: string): Promise<TmdbPersonSearchResult[]>;
};

/** Cliente da OMDb: notas por id do IMDb. */
export type OmdbClient = {
  getRatings(imdbId: string): Promise<OmdbRatings>;
};

/** Cliente do Letterboxd: nota por id do TMDb. */
export type LetterboxdClient = {
  getRating(tmdbId: number): Promise<LetterboxdRating>;
};

/** Cliente do bechdeltest.com: o índice com todos os filmes e a página de um filme. */
export type BechdelClient = {
  getIndex(): Promise<BechdelIndexEntry[]>;
  getMoviePage(siteId: number): Promise<BechdelPage>;
};

/** Prêmios por id do TMDb (filme ou pessoa); quem não tem prêmio fica fora do mapa. */
export type AwardsById = Map<number, AwardItem[]>;

/** Prêmios de filmes no Wikidata e o título do artigo de cada filme na Wikipedia em inglês. */
export type WikidataMovieAwards = {
  awards: AwardsById;
  enwikiTitles: Map<number, string>; // id do TMDb -> título do artigo (sitelink enwiki)
};

/** Cliente do Wikidata: prêmios (P166) e indicações (P1411) por id do TMDb, uma consulta SPARQL por lote. */
export type WikidataClient = {
  awardsByTmdbIds(tmdbIds: number[]): Promise<WikidataMovieAwards>;
  personAwardsByTmdbIds(personIds: number[]): Promise<AwardsById>;
};

/** Artigo de um filme na Wikipedia em inglês, com o título vindo do sitelink do Wikidata. */
export type WikipediaArticle = {
  tmdbId: number;
  title: string;
};

/** Cliente da Wikipedia: prêmios pelas categorias do artigo em inglês (Framboesa de Ouro e principais). */
export type WikipediaClient = {
  awardsByArticles(articles: WikipediaArticle[]): Promise<AwardsById>;
};

/** Pedido de texto estruturado ao Gemini. */
export type GeminiRequest<T> = {
  model: string; // uma das versões fixas de GEMINI_MODELS
  system?: string | undefined;
  prompt: string;
  schema: z.ZodType<T>; // formato da resposta; vira o JSON Schema pedido ao modelo e valida o que volta
};

/** Cliente do Gemini: gera JSON validado. Os comentários vão só como texto, sem nomes. */
export type GeminiClient = {
  generateJson<T>(request: GeminiRequest<T>): Promise<T>;
};

/** Os clientes das fontes, como as rotas recebem. */
export type SourceClients = {
  tmdb: TmdbClient;
  tmdbDiscover: TmdbDiscoverClient; // busca avançada (/discover, em alta, detalhes extras)
  omdb: OmdbClient;
  letterboxd: LetterboxdClient;
  bechdel: BechdelClient;
  wikidata: WikidataClient;
  wikipedia: WikipediaClient;
  gemini: GeminiClient;
};
