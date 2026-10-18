import type { RankedEntry } from '../events/list-entries.js';
import type { Dependencies } from '../types/dependencies.js';
import type { FeedKind, FeedType, RouteRef } from '../types/feed.js';
import type { List } from '../types/list.js';
import type { Movie } from '../types/movie.js';
import type { NotifyTypes } from '../types/notify.js';
import type { UsageRecorder } from '../types/usage.js';

/** Tipos e tabelas da notificação diária (rotinas notify-*). */

/** Assunto de uma notificação diária. */
export type DailyTopic =
  | 'quiz'
  | 'memory'
  | 'curio'
  | 'duel'
  | 'milestone'
  | 'releaseAnniversary'
  | 'birthday'
  | 'release'
  | 'streaming'
  | 'retro';

/** Tipo do item da Atividade de uma notificação diária. */
export type DailyFeedType = Extract<FeedType, `daily.${string}`>;

/** Conteúdo pronto de uma notificação diária, só com dados reais. */
export type DailyContent = {
  type: DailyFeedType;
  title: string;
  body?: string | undefined;
  quote?: string | undefined; // comentário verbatim, lido do banco
  route: RouteRef;
};

/** Uma lista e o que a rotina leu dela, lido uma vez por execução e usado por todos os integrantes. */
export type DailyList = {
  listId: string;
  list: List;
  entries: RankedEntry[]; // na ordem do ranking
  movies: Map<number, Movie>; // movies/{tmdbId} das entradas
  releases: Map<number, string>; // data de estreia (AAAA-MM-DD) dos filmes que têm `release` guardado
};

/** O que cada assunto recebe para montar o conteúdo. */
export type DailyContext = {
  dependencies: Dependencies;
  usage: UsageRecorder;
  list: DailyList;
  uid: string; // quem vai receber
  day: string; // dia de Brasília, AAAA-MM-DD
  now: Date;
};

/** Monta o conteúdo de um assunto, ou null quando não há o que dizer hoje. */
export type DailyComposer = (context: DailyContext) => Promise<DailyContent | null>;

/** Preferência (NotifyPrefs.types) que liga cada assunto. Os dois aniversários dependem de `birthday`. */
export const TOPIC_PREFERENCE: Record<DailyTopic, keyof NotifyTypes> = {
  quiz: 'quiz',
  memory: 'memory',
  curio: 'curio',
  duel: 'duel',
  milestone: 'milestone',
  releaseAnniversary: 'birthday',
  birthday: 'birthday',
  release: 'release',
  streaming: 'streaming',
  retro: 'retro',
};

/** Grupo na Atividade (e canal do Android) de cada tipo diário. */
export const DAILY_KIND: Record<DailyFeedType, FeedKind> = {
  'daily.quiz': 'quiz',
  'daily.curio': 'curiosidade',
  'daily.release': 'curiosidade',
  'daily.streaming': 'curiosidade',
  'daily.memory': 'lembrete',
  'daily.retro': 'lembrete',
  'daily.releaseAnniversary': 'lembrete',
  'daily.birthday': 'lembrete',
  'daily.duel': 'lista',
  'daily.milestone': 'lista',
};
