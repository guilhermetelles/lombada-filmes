import * as z from 'zod';
import { DEFAULT_NOTIFY_PREFS } from '../notify/default-notify-prefs.js';
import type { DeviceToken, NotifyLog, NotifyPrefs, NotifyState } from '../types/notify.js';
import { BrazilDaySchema } from './dates.js';
import { FeedTypeSchema } from './feed.js';
import { firestoreDate } from './firestore.js';

/** Preferências de notificação: corpo de PUT /api/me/notify e campo prefs de notifyState/{uid}. */
export const NotifyPrefsSchema: z.ZodType<NotifyPrefs> = z.object({
  freq: z.literal([0, 1, 3, 7], 'freq deve ser 0, 1, 3 ou 7'),
  hour: z.literal([9, 12, 19, 21], 'hour deve ser 9, 12, 19 ou 21'),
  types: z.object({
    quiz: z.boolean(),
    curio: z.boolean(),
    memory: z.boolean(),
    retro: z.boolean(),
    release: z.boolean(),
    streaming: z.boolean(),
    duel: z.boolean(),
    milestone: z.boolean(),
    birthday: z.boolean(),
  }),
  activity: z.boolean(),
  activityGrouped: z.boolean(),
});

/** notifyState/{uid}, validado ao ler; sem prefs gravadas, vale o padrão. */
export const NotifyStateSchema: z.ZodType<NotifyState> = z.object({
  prefs: NotifyPrefsSchema.default(DEFAULT_NOTIFY_PREFS),
  lastActivityPushAt: firestoreDate.optional(),
  pushesDay: BrazilDaySchema.optional(),
  pushesCount: z.number().int().nonnegative().optional(),
});

/** notifyLog/{uid}_{dia}, validado ao ler. */
export const NotifyLogSchema: z.ZodType<NotifyLog> = z.object({
  type: FeedTypeSchema,
  listId: z.string(),
  sentAt: firestoreDate,
});

/** devices/{uid}/tokens/{sha256}, validado ao ler. */
export const DeviceTokenSchema: z.ZodType<DeviceToken> = z.object({
  token: z.string().min(1),
  platform: z.literal('android'),
  updatedAt: firestoreDate,
});
