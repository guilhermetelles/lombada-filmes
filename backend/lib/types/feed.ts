/** Atividade da lista: lists/{listId}/feed/{feedId}, gravado só pelo backend. */

/** O que gerou o item. */
export type FeedType =
  | 'member.activity'
  | 'queue.added'
  | 'quiz.result'
  | 'quiz.winner'
  | 'daily.quiz'
  | 'daily.curio'
  | 'daily.memory'
  | 'daily.retro'
  | 'daily.release'
  | 'daily.streaming'
  | 'daily.duel'
  | 'daily.milestone'
  | 'daily.releaseAnniversary'
  | 'daily.birthday';

/** Grupo do item na tela de Atividade; também é o canal da notificação no Android. */
export type FeedKind = 'lista' | 'quiz' | 'curiosidade' | 'lembrete';

/** Telas do app que um item ou uma notificação pode abrir. */
export type RouteName =
  | 'movie'
  | 'person'
  | 'quiz'
  | 'quizPlay'
  | 'queue'
  | 'recs'
  | 'feed'
  | 'listInfo'
  | 'retro'
  | 'duel'
  | 'memory'
  | 'reports';

/** Argumentos da tela aberta. */
export type RouteArgs = {
  tmdbId?: number | undefined;
  personId?: number | undefined;
  day?: string | undefined; // AAAA-MM-DD
  month?: string | undefined; // AAAA-MM
  entryId?: string | undefined;
  entryIdB?: string | undefined;
};

/** Tela que o app abre ao tocar no item ou na notificação. */
export type RouteRef = {
  name: RouteName;
  args?: RouteArgs | undefined;
};

/** Documento lists/{listId}/feed/{feedId}. Textos prontos, em português, só com dados reais. */
export type FeedItem = {
  type: FeedType;
  kind: FeedKind;
  createdAt: Date;
  actorUid?: string | undefined;
  title: string;
  body?: string | undefined;
  quote?: string | undefined; // comentário citado verbatim, lido do Firestore
  route: RouteRef;
};
