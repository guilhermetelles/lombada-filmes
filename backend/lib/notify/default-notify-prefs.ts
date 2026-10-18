import type { NotifyPrefs } from '../types/notify.js';

/** Preferências de quem nunca mexeu nelas: a cada 3 dias, às 19h de Brasília, tudo ligado. */
export const DEFAULT_NOTIFY_PREFS: NotifyPrefs = {
  freq: 3,
  hour: 19,
  types: {
    quiz: true,
    curio: true,
    memory: true,
    retro: true,
    release: true,
    streaming: true,
    duel: true,
    milestone: true,
    birthday: true,
  },
  activity: true,
  activityGrouped: true,
};
