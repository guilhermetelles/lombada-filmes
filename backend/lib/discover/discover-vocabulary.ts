import type { Dec, Dur, Mood, Theme } from '../types/discover.js';

/**
 * Vocabulário da busca avançada traduzido para o /discover/movie do TMDb. Todos os ids abaixo foram
 * conferidos um a um na API do TMDb em 2026-10-18 (nenhum copiado do mock):
 * - gêneros em /genre/movie/list?language=pt-BR;
 * - palavras-chave em /search/keyword?query=… e /keyword/{id}, com a contagem de filmes de
 *   /discover/movie?with_keywords={id} entre parênteses;
 * - serviços em /watch/providers/movie?watch_region=BR (nome exato do TMDb).
 */

/** Gêneros de filme do TMDb, com o nome em pt-BR como o TMDb devolve (o mesmo de movies/{id}.genres). */
export const TMDB_GENRES: Readonly<Record<number, string>> = {
  28: 'Ação',
  12: 'Aventura',
  16: 'Animação',
  35: 'Comédia',
  80: 'Crime',
  99: 'Documentário',
  18: 'Drama',
  10751: 'Família',
  14: 'Fantasia',
  36: 'História',
  27: 'Terror',
  10402: 'Música',
  9648: 'Mistério',
  10749: 'Romance',
  878: 'Ficção científica',
  10770: 'Cinema TV',
  53: 'Thriller',
  10752: 'Guerra',
  37: 'Faroeste',
};

/** Outros nomes aceitos para um gênero (sem acento, minúsculas), além do nome do TMDb. */
export const GENRE_ALIASES: Readonly<Record<string, number>> = {
  suspense: 53,
  'sci-fi': 878,
  ficcao: 878,
  musical: 10402,
  western: 37,
  policial: 80,
  documentarios: 99,
  'filme de tv': 10770,
};

/** Palavras-chave do TMDb usadas pelos temas e humores (id → nome no TMDb). */
export const KEYWORDS = {
  lgbt: 158718, // "lgbt" (7.289)
  lesbian: 264386, // "lesbian" (814)
  queer: 250606, // "queer" (1.103)
  transgender: 290527, // "transgender" (471)
  gay: 363345, // "gay" (121)
  basedOnTrueStory: 9672, // "based on true story" (3.367)
  biography: 5565, // "biography" (4.936)
  trueCrime: 33722, // "true crime" (585)
  bMovie: 11034, // "b movie" (568)
  campy: 155493, // "campy" (328)
  grindhouse: 11532, // "grindhouse" (112)
  splatter: 344603, // "splatter" (74)
  soBadItsGood: 323812, // "so bad it’s good" (29)
  spoof: 11931, // "spoof" (391)
  timeTravel: 4379, // "time travel" (1.148)
  timeLoop: 10854, // "time loop" (243)
  heist: 10051, // "heist" (571)
  robbery: 642, // "robbery" (763)
  conArtist: 10453, // "con artist" (131)
  spaceTravel: 3801, // "space travel" (225)
  astronaut: 14626, // "astronaut" (251)
  spaceship: 252937, // "spaceship" (114)
  outerSpace: 252634, // "outer space" (75)
  zombie: 12377, // "zombie" (1.536)
  vampire: 3133, // "vampire" (1.522)
  halloween: 3335, // "halloween" (1.009)
  serialKiller: 10714, // "serial killer" (1.829)
  basedOnNovelOrBook: 818, // "based on novel or book" (8.439)
  tearjerker: 156924, // "tearjerker" (64)
  grief: 9872, // "grief" (1.199)
  tragedy: 10614, // "tragedy" (550)
  terminalIllness: 6564, // "terminal illness" (228)
  surrealism: 9887, // "surrealism" (1.248)
  filmNoir: 9807, // "film noir" (1.074)
  midnightMovie: 367333, // "midnight movie" (4)
  cultFilm: 374649, // "cult film" (8)
} as const;

/** Palavras-chave de cada tema; um filme entra se tiver qualquer uma (OU, "|" no TMDb). */
export const THEME_KEYWORDS: Readonly<Record<Theme, readonly number[]>> = {
  lgbt: [KEYWORDS.lgbt, KEYWORDS.lesbian, KEYWORDS.queer, KEYWORDS.transgender, KEYWORDS.gay],
  fatos: [KEYWORDS.basedOnTrueStory, KEYWORDS.biography, KEYWORDS.trueCrime],
  trash: [KEYWORDS.bMovie, KEYWORDS.campy, KEYWORDS.grindhouse, KEYWORDS.splatter, KEYWORDS.soBadItsGood],
  tempo: [KEYWORDS.timeTravel, KEYWORDS.timeLoop],
  golpes: [KEYWORDS.heist, KEYWORDS.robbery, KEYWORDS.conArtist],
  espaco: [KEYWORDS.spaceTravel, KEYWORDS.astronaut, KEYWORDS.spaceship, KEYWORDS.outerSpace],
  'zumbis-vampiros': [KEYWORDS.zombie, KEYWORDS.vampire],
  halloween: [KEYWORDS.halloween],
  'serial-killer': [KEYWORDS.serialKiller],
  livro: [KEYWORDS.basedOnNovelOrBook],
};

/** Como um humor vira consulta: gêneros (qualquer um), gêneros excluídos e palavras-chave (qualquer uma). */
export type MoodQuery = {
  anyGenres?: readonly number[];
  withoutGenres?: readonly number[];
  anyKeywords?: readonly number[];
};

/**
 * Cada humor no /discover. "Leve" e "tenso" são só gêneros; os outros dependem de palavras-chave,
 * porque o TMDb não tem gênero para "ruim divertido" nem "cult".
 */
export const MOOD_QUERIES: Readonly<Record<Mood, MoodQuery>> = {
  leve: { anyGenres: [35, 16, 10751, 10749], withoutGenres: [27, 53, 80, 10752] },
  tenso: { anyGenres: [53, 27, 9648] },
  'ruim-divertido': {
    anyKeywords: [KEYWORDS.soBadItsGood, KEYWORDS.bMovie, KEYWORDS.campy, KEYWORDS.spoof],
  },
  chorar: {
    anyGenres: [18],
    anyKeywords: [KEYWORDS.tearjerker, KEYWORDS.grief, KEYWORDS.tragedy, KEYWORDS.terminalIllness],
  },
  cult: {
    anyKeywords: [
      KEYWORDS.surrealism,
      KEYWORDS.filmNoir,
      KEYWORDS.soBadItsGood,
      KEYWORDS.midnightMovie,
      KEYWORDS.cultFilm,
    ],
  },
};

/** Faixa de duração em minutos (limites inclusivos; null é aberto). */
export const DUR_RANGES: Readonly<Record<Dur, { min: number | null; max: number | null }>> = {
  ate90: { min: null, max: 90 },
  '90a120': { min: 91, max: 120 },
  mais120: { min: 121, max: null },
};

/** Faixa de anos de cada década (limites inclusivos; null é aberto). */
export const DEC_RANGES: Readonly<Record<Dec, { from: number | null; to: number | null }>> = {
  antes70: { from: null, to: 1969 },
  '1970': { from: 1970, to: 1979 },
  '1980': { from: 1980, to: 1989 },
  '1990': { from: 1990, to: 1999 },
  '2000': { from: 2000, to: 2009 },
  '2010': { from: 2010, to: 2019 },
  '2020': { from: 2020, to: 2029 },
};

/** Um serviço de streaming no Brasil: nome e id no TMDb e outros nomes aceitos (sem acento, minúsculas). */
export type StreamingService = { id: number; name: string; aliases: readonly string[] };

/** Serviços por assinatura mais usados no Brasil, na ordem de destaque do TMDb para o BR. */
export const STREAMING_SERVICES: readonly StreamingService[] = [
  { id: 8, name: 'Netflix', aliases: [] },
  { id: 119, name: 'Amazon Prime Video', aliases: ['prime video', 'prime', 'amazon', 'amazon prime'] },
  { id: 350, name: 'Apple TV', aliases: ['apple tv+', 'apple tv plus', 'apple'] },
  { id: 337, name: 'Disney Plus', aliases: ['disney+', 'disney'] },
  { id: 167, name: 'Claro video', aliases: ['claro'] },
  { id: 47, name: 'Looke', aliases: [] },
  { id: 531, name: 'Paramount Plus', aliases: ['paramount+', 'paramount'] },
  { id: 1899, name: 'HBO Max', aliases: ['max', 'hbo'] },
  { id: 307, name: 'Globoplay', aliases: ['globo play'] },
  { id: 283, name: 'Crunchyroll', aliases: [] },
  { id: 11, name: 'MUBI', aliases: [] },
  { id: 447, name: 'Belas Artes à La Carte', aliases: ['belas artes'] },
  { id: 499, name: 'Oldflix', aliases: [] },
  { id: 544, name: 'Libreflix', aliases: [] },
  { id: 300, name: 'Pluto TV', aliases: ['pluto'] },
];

/**
 * Normaliza um nome para comparar: minúsculas, sem acentos e sem espaços nas pontas.
 *
 * @param text - Nome digitado ou devolvido pelo Gemini.
 * @returns O nome normalizado.
 */
export function foldName(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Acha o id do TMDb de um gênero pelo nome em pt-BR ou por um dos outros nomes aceitos.
 *
 * @param name - Nome do gênero.
 * @returns O id, ou undefined se o nome não for de um gênero conhecido.
 */
export function genreIdByName(name: string): number | undefined {
  const folded = foldName(name);
  for (const [id, genre] of Object.entries(TMDB_GENRES)) if (foldName(genre) === folded) return Number(id);
  return GENRE_ALIASES[folded];
}

/**
 * Acha um serviço de streaming pelo nome do TMDb ou por um dos outros nomes aceitos.
 *
 * @param name - Nome do serviço.
 * @returns O serviço, ou undefined se não for um dos conhecidos.
 */
export function streamingServiceByName(name: string): StreamingService | undefined {
  const folded = foldName(name);
  return STREAMING_SERVICES.find((service) => foldName(service.name) === folded || service.aliases.includes(folded));
}
