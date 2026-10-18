import type { Firestore } from 'firebase-admin/firestore';
import { writeFeedItem } from '../feed/write-feed-item.js';
import { createIfAbsent } from '../firestore/idempotent.js';
import { listsOfMember } from '../lists/list-repository.js';
import { logger } from '../logging/logger.js';
import { DEFAULT_NOTIFY_PREFS } from '../notify/default-notify-prefs.js';
import { notifyLogDocument, notifyStateCollection, notifyStateDocument } from '../notify/notify-repository.js';
import { sendFcm } from '../notify/send-fcm.js';
import { brazilDay } from '../time/brazil-day.js';
import type { Dependencies } from '../types/dependencies.js';
import type { NotifyHour, NotifyPrefs } from '../types/notify.js';
import type { UsageRecorder } from '../types/usage.js';
import { chooseDailyContent } from './choose-daily-content.js';
import { DAILY_KIND, type DailyList } from './daily-content.js';
import { addDays } from './day-math.js';
import { loadDailyList } from './load-daily-list.js';

/** Tempo de trabalho por execução, abaixo do maxDuration de 300 s da função. */
const TIME_BUDGET_MS = 240_000;

/** O que aconteceu com uma pessoa. */
type PersonOutcome = 'sent' | 'alreadySent' | 'frequency' | 'noContent';

/** Relatório de uma execução de notify-*. */
export type DailyNotifyReport = {
  hour: NotifyHour;
  day: string; // dia de Brasília a que as notificações se referem
  people: number; // quem escolheu este horário com a notificação ligada
  sent: number;
  alreadySent: number; // já tinha notifyLog do dia (execução repetida)
  frequency: number; // recebeu há menos dias que a frequência escolhida
  noContent: number;
  failed: number;
  unfinished: number; // ficaram para depois por falta de tempo
};

/**
 * Rotina notify-{hora}: manda a notificação do dia a quem escolheu esse horário de Brasília. O dia
 * é o de Brasília no momento da execução (a das 21h roda às 00:00 UTC, que ainda é o dia anterior
 * em Brasília). Para cada pessoa: respeita a frequência pelo notifyLog dos dias anteriores, escolhe
 * o conteúdo (chooseDailyContent), cria notifyLog/{uid}_{dia} com create() (rodar de novo não
 * reenvia), grava o item `daily-{uid}-{dia}` na Atividade e manda o aviso no canal do tipo.
 *
 * @param dependencies - Banco, fontes, FCM e relógio.
 * @param usage - Medidor de consumo da execução.
 * @param hour - Horário de Brasília da rotina.
 * @returns O relatório.
 */
async function runDailyNotify(
  dependencies: Dependencies,
  usage: UsageRecorder,
  hour: NotifyHour,
): Promise<DailyNotifyReport> {
  const startedAt = Date.now();
  const now = dependencies.now();
  const day = brazilDay(now);
  const people = await peopleForHour(dependencies.db, hour);
  const report: DailyNotifyReport = {
    hour,
    day,
    people: people.size,
    sent: 0,
    alreadySent: 0,
    frequency: 0,
    noContent: 0,
    failed: 0,
    unfinished: 0,
  };
  const lists = new Map<string, Promise<DailyList>>();

  for (const [uid, prefs] of people) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      report.unfinished++;
      continue;
    }
    try {
      report[await notifyPerson({ dependencies, usage, uid, prefs, day, now, lists })]++;
    } catch (error) {
      report.failed++;
      logger.error('notificação diária falhou', { uid, day, error });
    }
  }
  return report;
}

/**
 * Quem escolheu o horário com a notificação ligada (consulta em notifyState pelo índice de
 * prefs.hour e prefs.freq). No horário padrão (19h) entram também os aparelhos registrados de
 * quem nunca gravou preferências, que valem o padrão.
 *
 * @param db - Firestore.
 * @param hour - Horário de Brasília.
 * @returns Preferências por uid.
 */
async function peopleForHour(db: Firestore, hour: NotifyHour): Promise<Map<string, NotifyPrefs>> {
  const people = new Map<string, NotifyPrefs>();
  const chosen = await notifyStateCollection(db).where('prefs.hour', '==', hour).where('prefs.freq', '>', 0).get();
  for (const doc of chosen.docs) {
    try {
      people.set(doc.id, doc.data().prefs);
    } catch (error) {
      logger.warn('notifyState fora do formato, pulado', { uid: doc.id, error });
    }
  }

  if (hour === DEFAULT_NOTIFY_PREFS.hour) {
    const owners = (await db.collection('devices').listDocuments()).map((ref) => ref.id);
    const states = owners.length > 0 ? await db.getAll(...owners.map((uid) => notifyStateDocument(db, uid))) : [];
    for (const state of states) if (!state.exists) people.set(state.id, DEFAULT_NOTIFY_PREFS);
  }
  return people;
}

/** O que notifyPerson precisa. */
type PersonRun = {
  dependencies: Dependencies;
  usage: UsageRecorder;
  uid: string;
  prefs: NotifyPrefs;
  day: string;
  now: Date;
  lists: Map<string, Promise<DailyList>>; // listas já lidas nesta execução
};

/**
 * Manda (ou não) a notificação do dia a uma pessoa.
 *
 * @param run - Dependências, pessoa, preferências, dia e o cache de listas.
 * @returns O que aconteceu.
 * @throws O erro do Firestore ou do FCM, se a gravação ou o envio falhar.
 */
async function notifyPerson({ dependencies, usage, uid, prefs, day, now, lists }: PersonRun): Promise<PersonOutcome> {
  const { db } = dependencies;
  const windowDays = Array.from({ length: prefs.freq }, (_, back) => addDays(day, -back));
  const logs = await db.getAll(...windowDays.map((windowDay) => notifyLogDocument(db, uid, windowDay)));
  if (logs[0]?.exists) return 'alreadySent';
  if (logs.some((log) => log.exists)) return 'frequency';

  const memberOf = (await listsOfMember(db, uid).get()).docs.sort(
    (a, b) => a.data().createdAt.getTime() - b.data().createdAt.getTime(),
  );
  const dailyLists = await Promise.all(
    memberOf.map((doc) => {
      const cached = lists.get(doc.id) ?? loadDailyList(db, doc.id, doc.data());
      lists.set(doc.id, cached);
      return cached;
    }),
  );

  const chosen = await chooseDailyContent({ dependencies, usage, uid, day, now }, dailyLists, prefs.types);
  if (!chosen) return 'noContent';
  const { content, list } = chosen;

  const claimed = await createIfAbsent(notifyLogDocument(db, uid, day), {
    type: content.type,
    listId: list.listId,
    sentAt: now,
  });
  if (!claimed) return 'alreadySent';

  const kind = DAILY_KIND[content.type];
  const { feedId } = await writeFeedItem(
    db,
    list.listId,
    {
      type: content.type,
      kind,
      createdAt: now,
      title: content.title,
      body: content.body,
      quote: content.quote,
      route: content.route,
    },
    `daily-${uid}-${day}`,
  );
  await sendFcm(dependencies, uid, {
    title: content.title,
    body: content.quote ? `“${content.quote}”` : (content.body ?? ''),
    listId: list.listId,
    feedId,
    route: content.route,
    channelId: kind,
  });
  return 'sent';
}

export { runDailyNotify };
