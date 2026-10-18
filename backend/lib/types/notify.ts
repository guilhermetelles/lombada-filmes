import type { FeedKind, FeedType, RouteRef } from './feed.js';

/** Notificações: preferências, aparelhos e registro de envios (só o backend lê e grava). */

/** De quantos em quantos dias vem a notificação diária; 0 desliga. */
export type NotifyFrequency = 0 | 1 | 3 | 7;

/** Horário de Brasília da notificação diária. */
export type NotifyHour = 9 | 12 | 19 | 21;

/** Tipos de notificação diária que a pessoa quer receber. */
export type NotifyTypes = {
  quiz: boolean;
  curio: boolean;
  memory: boolean;
  retro: boolean;
  release: boolean;
  streaming: boolean;
  duel: boolean;
  milestone: boolean;
  birthday: boolean;
};

/** Preferências de notificação (GET e PUT /api/me/notify). */
export type NotifyPrefs = {
  freq: NotifyFrequency;
  hour: NotifyHour;
  types: NotifyTypes;
  activity: boolean; // avisos de atividade do outro membro
  activityGrouped: boolean;
};

/** Documento notifyState/{uid}. */
export type NotifyState = {
  prefs: NotifyPrefs;
  lastActivityPushAt?: Date | undefined;
  pushesDay?: string | undefined; // AAAA-MM-DD de Brasília a que pushesCount se refere
  pushesCount?: number | undefined;
};

/** Documento notifyLog/{uid}_{dia}: a notificação diária que já saiu. */
export type NotifyLog = {
  type: FeedType;
  listId: string;
  sentAt: Date;
};

/** Plataforma de um aparelho registrado. */
export type DevicePlatform = 'android';

/** Documento devices/{uid}/tokens/{sha256 do token}. */
export type DeviceToken = {
  token: string;
  platform: DevicePlatform;
  updatedAt: Date;
};

/** Uma notificação a mandar para todos os aparelhos de uma pessoa (contrato §4). */
export type PushMessage = {
  title: string;
  body: string;
  listId: string;
  feedId?: string | undefined;
  route: RouteRef;
  channelId: FeedKind; // canal do Android, igual ao kind do item da Atividade
  tag?: string | undefined; // aviso com a mesma tag substitui o anterior (atividade: activity-{listId})
};

/** Resultado do envio para os aparelhos de uma pessoa. */
export type PushResult = {
  sent: number; // aparelhos que o FCM aceitou
  removed: number; // tokens inválidos apagados
};
