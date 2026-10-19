import type { Firestore } from 'firebase-admin/firestore';
import { feedCollection } from '../feed/feed-repository.js';
import { writeFeedItem } from '../feed/write-feed-item.js';
import { createIfAbsent } from '../firestore/idempotent.js';
import { listsOfMember } from '../lists/list-repository.js';
import { logger } from '../logging/logger.js';
import { DEFAULT_NOTIFY_PREFS } from '../notify/default-notify-prefs.js';
import {
  lacksNotifyPrefs,
  notifyLogDocument,
  notifyStateCollection,
  notifyStateDocument,
  rawNotifyStateDocument,
} from '../notify/notify-repository.js';
import { sendFcm } from '../notify/send-fcm.js';
import { answersCollection } from '../quiz/quiz-repository.js';
import { QuizDocSchema } from '../schemas/quiz.js';
import { brazilDay } from '../time/brazil-day.js';
import type { Dependencies } from '../types/dependencies.js';
import type { FeedItem } from '../types/feed.js';
import type { NotifyHour, NotifyPrefs, NotifyTypes } from '../types/notify.js';
import type { UsageRecorder } from '../types/usage.js';
import { type ChosenContent, chooseDailyContent } from './choose-daily-content.js';
import {
  DAILY_KIND,
  type DailyContent,
  type DailyContext,
  type DailyFeedType,
  type DailyList,
  TYPE_PREFERENCE,
} from './daily-content.js';
import { addDays } from './day-math.js';
import { loadDailyList } from './load-daily-list.js';
import { composeQuiz } from './topics/quiz-topic.js';

/** Tempo de trabalho por execução, abaixo do maxDuration de 300 s da função. */
const TIME_BUDGET_MS = 240_000;

/** A pergunta do quiz sai sempre na rotina das 9h, qualquer que seja o horário escolhido. */
export const QUIZ_HOUR: NotifyHour = 9;

/** Na rotina das 21h, quem recebeu o quiz às 9h e ainda não respondeu recebe um lembrete. */
export const QUIZ_REMINDER_HOUR: NotifyHour = 21;

/** Título do lembrete do quiz das 21h. */
export const QUIZ_REMINDER_TITLE = 'Ainda dá tempo';

/** O que aconteceu com uma pessoa. */
type PersonOutcome = 'sent' | 'alreadySent' | 'frequency' | 'noContent' | 'typeOff';

/** Relatório de uma execução de notify-*. */
export type DailyNotifyReport = {
  hour: NotifyHour;
  day: string; // dia de Brasília a que as notificações se referem
  people: number; // quem recebe algo nesta rotina (assunto no horário escolhido ou quiz às 9h)
  sent: number; // assuntos do dia enviados (sem o quiz)
  quizSent: number; // perguntas do quiz enviadas
  quizReminded: number; // lembretes do quiz enviados (só na rotina das 21h)
  alreadySent: number; // já tinha notifyLog do dia (execução repetida)
  frequency: number; // recebeu há menos dias que a frequência escolhida
  noContent: number;
  typeOff: number; // o assunto do dia da lista é de um tipo que a pessoa desligou
  failed: number;
  unfinished: number; // ficaram para depois por falta de tempo
};

/**
 * Rotina notify-{hora}. O dia é o de Brasília no momento da execução (a das 21h roda às 00:00 UTC,
 * que ainda é o dia anterior em Brasília). Às 9h, todo mundo com o quiz ligado recebe a pergunta do
 * dia, se ainda não respondeu. Em cada horário, quem o escolheu recebe o assunto do dia da lista,
 * que é o mesmo para todos os membros: sorteado uma vez por lista e dia, entre os tipos que algum
 * membro ligou, e gravado num item só da Atividade. Quem desligou o tipo sorteado fica sem o aviso
 * naquele dia. O assunto respeita a frequência da pessoa; o quiz é diário.
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
  const topicPeople = await peopleForHour(dependencies.db, hour);
  const quizPeople = hour === QUIZ_HOUR ? await peopleWithNotifications(dependencies.db) : new Map();
  const people = new Map<string, NotifyPrefs>([...quizPeople, ...topicPeople]);
  const report: DailyNotifyReport = {
    hour,
    day,
    people: people.size,
    sent: 0,
    quizSent: 0,
    quizReminded: 0,
    alreadySent: 0,
    frequency: 0,
    noContent: 0,
    typeOff: 0,
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
      const outcomes = await notifyPerson(
        { dependencies, usage, uid, prefs, day, now, lists },
        { quiz: quizPeople.has(uid), topic: topicPeople.has(uid) },
      );
      if (outcomes.topic) report[outcomes.topic]++;
      if (outcomes.quiz === 'sent') report.quizSent++;
    } catch (error) {
      report.failed++;
      logger.error('notificação diária falhou', { uid, day, error });
    }
  }

  if (hour === QUIZ_REMINDER_HOUR) {
    for (const [uid, prefs] of await peopleWithNotifications(dependencies.db)) {
      if (!prefs.types.quiz) continue;
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        report.unfinished++;
        continue;
      }
      try {
        if (await remindQuiz(dependencies, uid, day, now)) report.quizReminded++;
      } catch (error) {
        report.failed++;
        logger.error('lembrete do quiz falhou', { uid, day, error });
      }
    }
  }
  return report;
}

/**
 * Lembrete das 21h: quem recebeu a pergunta às 9h (existe notifyLog/{uid}_{dia}-quiz) e ainda não
 * respondeu recebe "Ainda dá tempo" com o enunciado, abrindo a pergunta do dia, no canal quiz. O
 * registro notifyLog/{uid}_{dia}-quiz2, criado com create(), impede o reenvio.
 *
 * @param dependencies - Banco e FCM.
 * @param uid - Pessoa.
 * @param day - Dia de Brasília.
 * @param now - Momento do envio.
 * @returns true se o lembrete saiu agora.
 * @throws O erro do Firestore ou do FCM, se a gravação ou o envio falhar.
 */
async function remindQuiz(dependencies: Dependencies, uid: string, day: string, now: Date): Promise<boolean> {
  const { db } = dependencies;
  const [morning, reminder] = await db.getAll(
    notifyLogDocument(db, uid, `${day}-quiz`),
    notifyLogDocument(db, uid, `${day}-quiz2`),
  );
  const listId = morning?.exists ? morning.get('listId') : undefined;
  if (typeof listId !== 'string' || reminder?.exists) return false;

  const quiz = QuizDocSchema.safeParse((await db.doc(`lists/${listId}/quizzes/${day}`).get()).data());
  if (!quiz.success) return false;
  if ((await answersCollection(db, listId, day).doc(uid).get()).exists) return false;

  const claimed = await createIfAbsent(notifyLogDocument(db, uid, `${day}-quiz2`), {
    type: 'daily.quiz',
    listId,
    sentAt: now,
  });
  if (!claimed) return false;
  await sendFcm(dependencies, uid, {
    title: QUIZ_REMINDER_TITLE,
    body: quiz.data.prompt,
    listId,
    feedId: `quiz-${day}`,
    route: { name: 'quizPlay', args: { day } },
    channelId: 'quiz',
  });
  return true;
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
  const chosen = await notifyStateCollection(db).where('prefs.hour', '==', hour).where('prefs.freq', '>', 0).get();
  const people = readPrefs(chosen.docs);
  if (hour === DEFAULT_NOTIFY_PREFS.hour) await addDefaultPeople(db, people);
  return people;
}

/**
 * Todo mundo com a notificação diária ligada, em qualquer horário, mais quem nunca gravou
 * preferências e tem aparelho registrado: são os que recebem o quiz às 9h.
 *
 * @param db - Firestore.
 * @returns Preferências por uid.
 */
async function peopleWithNotifications(db: Firestore): Promise<Map<string, NotifyPrefs>> {
  const people = readPrefs((await notifyStateCollection(db).where('prefs.freq', '>', 0).get()).docs);
  await addDefaultPeople(db, people);
  return people;
}

/**
 * Lê as preferências dos documentos de notifyState, pulando os que estão fora do formato.
 *
 * @param docs - Documentos lidos.
 * @returns Preferências por uid.
 */
function readPrefs(docs: readonly { id: string; data(): { prefs: NotifyPrefs } }[]): Map<string, NotifyPrefs> {
  const people = new Map<string, NotifyPrefs>();
  for (const doc of docs) {
    try {
      people.set(doc.id, doc.data().prefs);
    } catch (error) {
      logger.warn('notifyState fora do formato, pulado', { uid: doc.id, error });
    }
  }
  return people;
}

/**
 * Acrescenta quem tem aparelho registrado e nunca gravou preferências (sem notifyState, ou com
 * notifyState sem `prefs`, como o que o aviso de atividade criava), com o padrão.
 *
 * @param db - Firestore.
 * @param people - Preferências por uid, completadas aqui.
 */
async function addDefaultPeople(db: Firestore, people: Map<string, NotifyPrefs>): Promise<void> {
  const owners = (await db.collection('devices').listDocuments()).map((ref) => ref.id);
  const states = owners.length > 0 ? await db.getAll(...owners.map((uid) => rawNotifyStateDocument(db, uid))) : [];
  for (const state of states) if (lacksNotifyPrefs(state)) people.set(state.id, DEFAULT_NOTIFY_PREFS);
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

/** O que aconteceu com uma pessoa: o assunto do dia e a pergunta do quiz (null se não era a vez). */
type PersonOutcomes = { topic: PersonOutcome | null; quiz: PersonOutcome | null };

/** Aviso do dia: o assunto da lista (sem o quiz) ou a pergunta do quiz, cada um com o próprio registro. */
type DailySlot = 'topic' | 'quiz';

/**
 * Manda (ou não) as notificações desta rotina a uma pessoa.
 *
 * @param run - Dependências, pessoa, preferências, dia e o cache de listas.
 * @param due - Se é a vez do quiz (rotina das 9h) e do assunto (horário escolhido).
 * @returns O que aconteceu com o assunto e com o quiz.
 * @throws O erro do Firestore ou do FCM, se a gravação ou o envio falhar.
 */
async function notifyPerson(run: PersonRun, due: { quiz: boolean; topic: boolean }): Promise<PersonOutcomes> {
  const { db } = run.dependencies;
  const memberOf = (await listsOfMember(db, run.uid).get()).docs.sort(
    (a, b) => a.data().createdAt.getTime() - b.data().createdAt.getTime(),
  );
  const dailyLists = await Promise.all(
    memberOf.map((doc) => {
      const cached = run.lists.get(doc.id) ?? loadDailyList(db, doc.id, doc.data());
      run.lists.set(doc.id, cached);
      return cached;
    }),
  );

  const quiz = due.quiz && run.prefs.types.quiz ? await notifySlot(run, dailyLists, 'quiz') : null;
  const topic = due.topic ? await notifySlot(run, dailyLists, 'topic') : null;
  return { topic, quiz };
}

/**
 * Manda um dos avisos do dia. O registro é notifyLog/{uid}_{dia} para o assunto e
 * notifyLog/{uid}_{dia}-quiz para o quiz, criado com create() (rodar de novo não reenvia). O
 * assunto aponta para o item `daily-{lista}-{dia}` da Atividade, o mesmo para todos os membros; o
 * quiz, para o item `quiz-{dia}` da lista, que a rotina quiz-and-month já gravou.
 *
 * @param run - Dependências, pessoa, preferências, dia e momento.
 * @param lists - Listas da pessoa, já lidas.
 * @param slot - Qual aviso.
 * @returns O que aconteceu.
 */
async function notifySlot(run: PersonRun, lists: readonly DailyList[], slot: DailySlot): Promise<PersonOutcome> {
  const { dependencies, usage, uid, prefs, day, now } = run;
  const { db } = dependencies;
  const logKey = (logDay: string) => (slot === 'quiz' ? `${logDay}-quiz` : logDay);
  // O quiz é diário para quem o ligou; a frequência só vale para o assunto do dia.
  const windowLength = slot === 'quiz' ? 1 : prefs.freq;
  const windowDays = Array.from({ length: windowLength }, (_, back) => addDays(day, -back));
  const logs = await db.getAll(...windowDays.map((windowDay) => notifyLogDocument(db, uid, logKey(windowDay))));
  if (logs[0]?.exists) return 'alreadySent';
  if (logs.some((log) => log.exists)) return 'frequency';

  const base = { dependencies, usage, uid, day, now };
  const chosen = slot === 'quiz' ? await chooseQuiz(base, lists) : await chooseListTopic(base, lists, prefs.types);
  if (chosen === 'typeOff') return 'typeOff';
  if (!chosen) return 'noContent';
  const { content, list } = chosen;

  const claimed = await createIfAbsent(notifyLogDocument(db, uid, logKey(day)), {
    type: content.type,
    listId: list.listId,
    sentAt: now,
  });
  if (!claimed) return 'alreadySent';

  const kind = DAILY_KIND[content.type];
  const feedId = slot === 'quiz' ? `quiz-${day}` : listTopicId(list.listId, day);
  await writeFeedItem(
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
    feedId,
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

/**
 * A pergunta do quiz de hoje ainda sem resposta da pessoa, na primeira lista que tiver uma.
 *
 * @param base - Dependências, consumo, pessoa, dia e momento.
 * @param lists - Listas da pessoa.
 * @returns O conteúdo e a lista, ou null.
 */
async function chooseQuiz(
  base: Omit<DailyContext, 'list'>,
  lists: readonly DailyList[],
): Promise<ChosenContent | null> {
  for (const list of lists) {
    const content = await composeQuiz({ ...base, list });
    if (content) return { content, list };
  }
  return null;
}

/**
 * O assunto do dia de uma das listas da pessoa, o mesmo para todos os membros. A primeira rotina do
 * dia sorteia o assunto (semente: dia e lista, entre os tipos que algum membro ligou) e grava o item
 * `daily-{lista}-{dia}` na Atividade; as rotinas dos outros horários reaproveitam esse item.
 *
 * @param base - Dependências, consumo, pessoa, dia e momento.
 * @param lists - Listas da pessoa, da mais antiga para a mais nova.
 * @param types - Tipos que a pessoa ligou.
 * @returns O conteúdo e a lista; 'typeOff' se havia assunto mas de um tipo que a pessoa desligou; null sem assunto.
 */
async function chooseListTopic(
  base: Omit<DailyContext, 'list'>,
  lists: readonly DailyList[],
  types: NotifyTypes,
): Promise<ChosenContent | 'typeOff' | null> {
  let typeOff = false;
  for (const list of lists) {
    const content = await listTopic(base, list);
    if (!content) continue;
    if (types[TYPE_PREFERENCE[content.type]]) return { content, list };
    typeOff = true;
  }
  return typeOff ? 'typeOff' : null;
}

/**
 * Lê o assunto do dia já gravado da lista ou, se ainda não há, sorteia e grava.
 *
 * @param base - Dependências, consumo, pessoa, dia e momento.
 * @param list - Lista.
 * @returns O assunto, ou null se nenhum tipo tiver o que dizer hoje.
 */
async function listTopic(base: Omit<DailyContext, 'list'>, list: DailyList): Promise<DailyContent | null> {
  const { db } = base.dependencies;
  const ref = feedCollection(db, list.listId).doc(listTopicId(list.listId, base.day));
  const stored = toDailyContent((await ref.get()).data());
  if (stored) return stored;

  const chosen = await chooseDailyContent(base, [list], await membersTypes(db, list), ['quiz'], list.listId);
  if (!chosen) return null;
  const { content } = chosen;
  const { created } = await writeFeedItem(
    db,
    list.listId,
    {
      type: content.type,
      kind: DAILY_KIND[content.type],
      createdAt: base.now,
      title: content.title,
      body: content.body,
      quote: content.quote,
      route: content.route,
    },
    ref.id,
  );
  // Outra rotina gravou antes: vale o que ficou gravado, para todos verem o mesmo.
  return created ? content : (toDailyContent((await ref.get()).data()) ?? content);
}

/**
 * Tipos que pelo menos um membro da lista deixou ligados (com a notificação diária ligada). Quem
 * nunca gravou preferências conta com o padrão. O assunto do dia é sorteado entre eles.
 *
 * @param db - Firestore.
 * @param list - Lista.
 * @returns Os tipos ligados por alguém.
 */
async function membersTypes(db: Firestore, list: DailyList): Promise<NotifyTypes> {
  const uids = list.list.memberUids;
  const states = uids.length > 0 ? await db.getAll(...uids.map((uid) => notifyStateDocument(db, uid))) : [];
  const union = Object.fromEntries(Object.keys(DEFAULT_NOTIFY_PREFS.types).map((type) => [type, false])) as NotifyTypes;
  for (const state of states) {
    const prefs = state.exists ? state.data()?.prefs : DEFAULT_NOTIFY_PREFS;
    if (!prefs || prefs.freq === 0) continue;
    for (const type of Object.keys(union) as (keyof NotifyTypes)[]) if (prefs.types[type]) union[type] = true;
  }
  return union;
}

/**
 * Converte o item da Atividade de volta no assunto do dia.
 *
 * @param item - Item lido, ou undefined.
 * @returns O assunto, ou null se não for um item diário.
 */
function toDailyContent(item: FeedItem | undefined): DailyContent | null {
  if (!item || !(item.type in DAILY_KIND)) return null;
  return {
    type: item.type as DailyFeedType,
    title: item.title,
    ...(item.body ? { body: item.body } : {}),
    ...(item.quote ? { quote: item.quote } : {}),
    route: item.route,
  };
}

/**
 * Id do item do assunto do dia de uma lista.
 *
 * @param listId - Lista.
 * @param day - Dia de Brasília.
 * @returns `daily-{lista}-{dia}`.
 */
function listTopicId(listId: string, day: string): string {
  return `daily-${listId}-${day}`;
}

export { runDailyNotify };
