import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { notify09CronRoute } from '../../api/cron/_notify-09.js';
import { notify19CronRoute } from '../../api/cron/_notify-19.js';
import { notify21CronRoute } from '../../api/cron/_notify-21.js';
import type { DailyNotifyReport } from '../../lib/daily/run-daily-notify.js';
import { DEFAULT_NOTIFY_PREFS } from '../../lib/notify/default-notify-prefs.js';
import { deviceTokenDocument, notifyLogDocument, notifyStateDocument } from '../../lib/notify/notify-repository.js';
import type { Movie } from '../../lib/types/movie.js';
import type { NotifyPrefs, NotifyTypes } from '../../lib/types/notify.js';
import type { Fetch } from '../../lib/types/sources.js';
import { createTestDependencies, TEST_CRON_SECRET } from '../support/dependencies.js';
import { resetEmulators } from '../support/emulators.js';
import { createFakeMessaging, type FakeMessaging } from '../support/fake-messaging.js';
import { fakeSources } from '../support/fake-sources.js';
import { sampleMovie } from './daily-samples.js';

const LIST = 'lista-1';
const ANA = 'ana';
const BIA = 'bia';

/** Filmes (ids reais do TMDb). */
const SPEED = 1637;
const ABYSS = 2756;
const TITANIC = 597;
const FIGHT_CLUB = 550;

/** Diretor das gravações de test/fixtures (The Abyss). */
const CAMERON = { id: 2710, name: 'James Cameron' };

let clock: Date;
let fcm: FakeMessaging;
let fetch: Fetch;
let dependencies: ReturnType<typeof createTestDependencies>;

beforeEach(async () => {
  await resetEmulators();
  clock = new Date('2026-10-18T22:00:00Z');
  fcm = createFakeMessaging();
  fetch = fakeSources().fetch;
  dependencies = createTestDependencies(
    (input, init) => fetch(input, init),
    () => clock,
    {
      messaging: fcm.messaging,
    },
  );

  await dependencies.db.doc(`lists/${LIST}`).set({
    name: 'Maratona',
    description: '',
    ownerUid: ANA,
    memberUids: [ANA, BIA],
    memberProfiles: { [ANA]: { name: 'Ana', photoUrl: null }, [BIA]: { name: 'Bia', photoUrl: null } },
    createdAt: new Date('2025-01-01T12:00:00Z'),
    updatedAt: new Date('2025-01-01T12:00:00Z'),
  });
  await deviceTokenDocument(dependencies.db, ANA, 'token-ana').set({
    token: 'token-ana',
    platform: 'android',
    updatedAt: clock,
  });
});

/** Tipos todos desligados, para cada teste ligar só o que testa. */
const NO_TYPES: NotifyTypes = Object.fromEntries(
  Object.keys(DEFAULT_NOTIFY_PREFS.types).map((key) => [key, false]),
) as NotifyTypes;

/**
 * Grava as preferências de Ana: todo dia às 19h, só com os tipos pedidos.
 *
 * @param types - Tipos a ligar.
 * @param extra - Outras preferências.
 */
async function prefsOfAna(types: Partial<NotifyTypes>, extra: Partial<NotifyPrefs> = {}): Promise<void> {
  await notifyStateDocument(dependencies.db, ANA).set({
    prefs: { ...DEFAULT_NOTIFY_PREFS, freq: 1, hour: 19, types: { ...NO_TYPES, ...types }, ...extra },
  });
}

/**
 * Grava uma entrada da lista.
 *
 * @param entryId - Id.
 * @param tmdbId - Filme.
 * @param title - Título.
 * @param rankKey - Ordem.
 * @param extra - Data em que viram, comentário e data de entrada.
 */
async function putEntry(
  entryId: string,
  tmdbId: number,
  title: string,
  rankKey: string,
  extra: { watchedOn?: string; comment?: string; createdAt?: Date | undefined } = {},
): Promise<void> {
  const createdAt = extra.createdAt ?? new Date('2025-01-01T12:00:00Z');
  await dependencies.db.doc(`lists/${LIST}/entries/${entryId}`).set({
    tmdbId,
    rankKey,
    watchedOn: extra.watchedOn ?? null,
    comment: extra.comment ?? '',
    addedBy: ANA,
    updatedBy: ANA,
    createdAt,
    updatedAt: createdAt,
    movie: { title, year: null, posterPath: null, imdb: null, letterboxd: null, directors: [] },
  });
}

/**
 * Grava movies/{tmdbId}.
 *
 * @param tmdbId - Filme.
 * @param title - Título.
 * @param extra - Campos do teste.
 */
async function putMovie(tmdbId: number, title: string, extra: Partial<Movie> & { release?: string } = {}) {
  await dependencies.db.doc(`movies/${tmdbId}`).set(sampleMovie(title, extra));
}

/**
 * Chama uma rotina com o segredo do cron.
 *
 * @param route - Rotina.
 * @returns O relatório.
 */
async function run(route: typeof notify19CronRoute = notify19CronRoute): Promise<DailyNotifyReport> {
  const response = await route(() => dependencies)(
    new Request('http://localhost/api/cron/notify', { headers: { authorization: `Bearer ${TEST_CRON_SECRET}` } }),
  );
  assert.equal(response.status, 200);
  return (await response.json()) as DailyNotifyReport;
}

const feedItem = async (id: string) => (await dependencies.db.doc(`lists/${LIST}/feed/${id}`).get()).data();

/**
 * Roda a rotina das 19h e devolve o item do dia de Ana e o aviso que saiu.
 *
 * @returns Item da Atividade e aviso.
 */
async function runAndRead() {
  const report = await run();
  const day = report.day;
  const item = await feedItem(`daily-${ANA}-${day}`);
  return { report, item, push: fcm.sent.at(-1) };
}

describe('rotinas notify-*', () => {
  test('quiz do dia ainda não respondido, dizendo quem já respondeu', async () => {
    await prefsOfAna({ quiz: true });
    const quiz = dependencies.db.doc(`lists/${LIST}/quizzes/2026-10-18`);
    await quiz.set({
      day: '2026-10-18',
      type: 'diretor',
      prompt: 'Quem dirigiu The Abyss?',
      options: [
        { id: 'a', label: 'James Cameron' },
        { id: 'b', label: 'Jan de Bont' },
      ],
      createdAt: clock,
    });
    await quiz.collection('answers').doc(BIA).set({ optionId: 'a', correct: true, answeredAt: clock });

    const { report, item, push } = await runAndRead();

    assert.equal(report.sent, 1);
    assert.deepEqual(
      { type: item?.type, kind: item?.kind, title: item?.title, body: item?.body, route: item?.route },
      {
        type: 'daily.quiz',
        kind: 'quiz',
        title: 'Quiz do dia',
        body: 'Quem dirigiu The Abyss? Bia já respondeu.',
        route: { name: 'quizPlay', args: { day: '2026-10-18' } },
      },
    );
    assert.deepEqual(push?.notification, { title: 'Quiz do dia', body: 'Quem dirigiu The Abyss? Bia já respondeu.' });
    assert.deepEqual(push?.android?.notification, { channelId: 'quiz' });
    assert.equal(push?.data?.feedId, `daily-${ANA}-2026-10-18`);
    assert.equal(push?.data?.route, JSON.stringify({ name: 'quizPlay', args: { day: '2026-10-18' } }));

    const log = (await notifyLogDocument(dependencies.db, ANA, '2026-10-18').get()).data();
    assert.deepEqual([log?.type, log?.listId, log?.sentAt.getTime()], ['daily.quiz', LIST, clock.getTime()]);
  });

  test('quiz já respondido, sem outro tipo ligado: nada sai', async () => {
    await prefsOfAna({ quiz: true });
    const quiz = dependencies.db.doc(`lists/${LIST}/quizzes/2026-10-18`);
    await quiz.set({
      day: '2026-10-18',
      type: 'ano',
      prompt: 'Em que ano saiu Speed?',
      options: [
        { id: 'a', label: '1994' },
        { id: 'b', label: '1996' },
      ],
      createdAt: clock,
    });
    await quiz.collection('answers').doc(ANA).set({ optionId: 'a', correct: true, answeredAt: clock });

    const report = await run();
    assert.deepEqual([report.sent, report.noContent], [0, 1]);
    assert.equal(fcm.sent.length, 0);
    assert.equal((await notifyLogDocument(dependencies.db, ANA, '2026-10-18').get()).exists, false);
  });

  test('ordem de recurso: sem quiz, vem o comentário do dia, verbatim, no canal lembrete', async () => {
    await prefsOfAna({ quiz: true, memory: true });
    await putEntry('e-speed', SPEED, 'Speed', 'a1', { watchedOn: '2025-10-20', comment: 'Ônibus que não pode parar.' });

    const { item, push } = await runAndRead();

    assert.deepEqual(
      { type: item?.type, kind: item?.kind, title: item?.title, body: item?.body, quote: item?.quote },
      {
        type: 'daily.memory',
        kind: 'lembrete',
        title: 'Há 1 ano, sobre Speed',
        body: 'Visto em 20/10/2025; hoje em #1 na lista.',
        quote: 'Ônibus que não pode parar.',
      },
    );
    assert.deepEqual(push?.notification, { title: 'Há 1 ano, sobre Speed', body: '“Ônibus que não pode parar.”' });
    assert.deepEqual(push?.android?.notification, { channelId: 'lembrete' });
  });

  test('curiosidade, duelo e marco, cada um sozinho', async () => {
    await putEntry('e-speed', SPEED, 'Speed', 'a1');
    await putEntry('e-abyss', ABYSS, 'The Abyss', 'a2');
    await putMovie(ABYSS, 'The Abyss', { budget: 69_500_000, revenue: 90_000_000, runtime: 140 });

    await prefsOfAna({ curio: true });
    let read = await runAndRead();
    assert.deepEqual(
      [read.item?.type, read.item?.kind, read.item?.title, read.item?.body],
      [
        'daily.curio',
        'curiosidade',
        'Você sabia?',
        'The Abyss custou US$ 69,5 milhões e faturou US$ 90 milhões no mundo.',
      ],
    );

    clock = new Date('2026-10-19T22:00:00Z');
    await prefsOfAna({ duel: true });
    read = await runAndRead();
    assert.deepEqual(
      [read.item?.type, read.item?.kind, read.item?.body, read.item?.route],
      [
        'daily.duel',
        'lista',
        'Vocês ainda acham que Speed (#1) é melhor que The Abyss (#2)?',
        { name: 'duel', args: { entryId: 'e-speed', entryIdB: 'e-abyss' } },
      ],
    );

    clock = new Date('2026-10-20T22:00:00Z');
    for (let index = 3; index <= 10; index++) {
      await putEntry(`e-${index}`, 1000 + index, `Filme ${index}`, `a${index + 10}`, {
        createdAt: index === 10 ? new Date('2026-10-19T12:00:00Z') : undefined,
      });
    }
    await prefsOfAna({ milestone: true });
    read = await runAndRead();
    assert.deepEqual(
      [read.item?.type, read.item?.title, read.item?.body, read.item?.route],
      [
        'daily.milestone',
        'Vocês chegaram a 10 filmes',
        'São 10 filmes e 2,3 horas de filme juntos.',
        { name: 'reports' },
      ],
    );
  });

  test('aniversário de estreia pelo campo release de movies/', async () => {
    clock = new Date('2026-08-10T22:00:00Z');
    await prefsOfAna({ birthday: true });
    await putEntry('e-abyss', ABYSS, 'The Abyss', 'a1');
    await putMovie(ABYSS, 'The Abyss', { release: '1989-08-09' });

    const { item } = await runAndRead();
    assert.deepEqual(
      [item?.type, item?.title, item?.body],
      [
        'daily.releaseAnniversary',
        'The Abyss fez 37 anos de estreia ontem',
        'Lançado em 09/08/1989; está em #1 na lista de vocês.',
      ],
    );
  });

  test('aniversário de pessoa recorrente na lista, com ficha em people/', async () => {
    clock = new Date('2026-08-16T22:00:00Z');
    await prefsOfAna({ birthday: true });
    await putEntry('e-titanic', TITANIC, 'Titanic', 'a1');
    await putEntry('e-abyss', ABYSS, 'The Abyss', 'a2');
    await putMovie(TITANIC, 'Titanic', { directors: [CAMERON] });
    await putMovie(ABYSS, 'The Abyss', { directors: [CAMERON] });
    await dependencies.db.doc(`people/${CAMERON.id}`).set({
      name: 'James Cameron',
      birthday: '1954-08-16',
      deathday: null,
      placeOfBirth: null,
      biography: null,
      bioLang: null,
      profilePath: null,
      imdbId: null,
      directedCount: 0,
      directed: [],
      actedCount: 0,
      acted: [],
      fetchedAt: clock,
    });

    const { item, push } = await runAndRead();
    assert.deepEqual(
      [item?.type, item?.kind, item?.title, item?.body, item?.route],
      [
        'daily.birthday',
        'lembrete',
        'James Cameron faz 72 anos hoje',
        'Na lista de vocês: Titanic e The Abyss.',
        { name: 'person', args: { personId: CAMERON.id } },
      ],
    );
    assert.deepEqual(push?.android?.notification, { channelId: 'lembrete' });
  });

  test('estreia: filme no /discover do TMDb com diretor da lista, confirmado nos créditos', async () => {
    await prefsOfAna({ release: true });
    await putEntry('e-titanic', TITANIC, 'Titanic', 'a1');
    await putMovie(TITANIC, 'Titanic', { directors: [CAMERON] });
    const discovered: URL[] = [];
    const recorded = fakeSources().fetch;
    fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname !== '/3/discover/movie') return recorded(input, init);
      discovered.push(url);
      const upcoming = url.searchParams.get('release_date.gte') === '2026-10-18';
      const results = upcoming
        ? [{ id: ABYSS, title: 'O Segredo do Abismo', release_date: '2026-11-05', genre_ids: [] }]
        : [];
      return Response.json({ page: 1, total_pages: 1, total_results: results.length, results });
    };

    const { item } = await runAndRead();

    assert.deepEqual(
      [item?.type, item?.kind, item?.title, item?.body, item?.route],
      [
        'daily.release',
        'curiosidade',
        'Vai estrear no Brasil: O Segredo do Abismo',
        'Direção de James Cameron, de Titanic, que está na lista de vocês.',
        { name: 'movie', args: { tmdbId: ABYSS } },
      ],
    );
    const [query] = discovered;
    assert.equal(query?.searchParams.get('region'), 'BR');
    assert.equal(query?.searchParams.get('with_people'), String(CAMERON.id));
    assert.equal(query?.searchParams.get('release_date.lte'), '2026-12-17');
  });

  test('estreia sem vínculo nos créditos: nada sai', async () => {
    await prefsOfAna({ release: true });
    await putEntry('e-titanic', TITANIC, 'Titanic', 'a1');
    await putMovie(TITANIC, 'Titanic', { directors: [{ id: 1, name: 'Outra Pessoa' }] });
    const recorded = fakeSources().fetch;
    fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname !== '/3/discover/movie') return recorded(input, init);
      return Response.json({
        page: 1,
        total_pages: 1,
        total_results: 1,
        results: [{ id: ABYSS, title: 'O Segredo do Abismo' }],
      });
    };

    const report = await run();
    assert.equal(report.noContent, 1);
  });

  test('chegou no streaming: filme da fila com serviço novo na busca de hoje', async () => {
    await prefsOfAna({ streaming: true });
    await dependencies.db
      .doc(`lists/${LIST}/queue/${FIGHT_CLUB}`)
      .set({ tmdbId: FIGHT_CLUB, addedBy: BIA, createdAt: clock });
    await putMovie(FIGHT_CLUB, 'Fight Club', {
      providersBR: { flatrate: ['Netflix', 'Max'], previous: ['Max'], fetchedAt: new Date('2026-10-18T07:10:00Z') },
    });

    const { item } = await runAndRead();
    assert.deepEqual(
      [item?.type, item?.kind, item?.title, item?.body, item?.route],
      [
        'daily.streaming',
        'curiosidade',
        'Chegou no streaming: Fight Club',
        'Está na fila de vocês e agora está em Netflix.',
        { name: 'movie', args: { tmdbId: FIGHT_CLUB } },
      ],
    );
  });

  test('streaming buscado em outro dia não conta como chegada', async () => {
    await prefsOfAna({ streaming: true });
    await dependencies.db
      .doc(`lists/${LIST}/queue/${FIGHT_CLUB}`)
      .set({ tmdbId: FIGHT_CLUB, addedBy: BIA, createdAt: clock });
    await putMovie(FIGHT_CLUB, 'Fight Club', {
      providersBR: { flatrate: ['Netflix'], previous: [], fetchedAt: new Date('2026-10-16T07:10:00Z') },
    });
    assert.equal((await run()).noContent, 1);
  });

  test('retrospectiva nos dias 1 a 3, uma vez só por mês', async () => {
    clock = new Date('2026-11-02T22:00:00Z');
    await prefsOfAna({ retro: true });
    await putEntry('e-speed', SPEED, 'Speed', 'a1');
    await dependencies.db.doc(`lists/${LIST}/retros/2026-10`).set({
      month: '2026-10',
      films: 3,
      minutes: 330,
      bestEntryId: 'e-speed',
      worstEntryId: null,
      genres: [],
      text: null,
      generatedAt: clock,
    });

    const { item } = await runAndRead();
    assert.deepEqual(
      [item?.type, item?.title, item?.body, item?.route],
      [
        'daily.retro',
        'Retrospectiva de outubro',
        '3 filmes e 5,5 horas de filme juntos. O melhor do mês está em #1: Speed.',
        { name: 'retro', args: { month: '2026-10' } },
      ],
    );

    clock = new Date('2026-11-03T22:00:00Z');
    assert.equal((await run()).noContent, 1, 'no dia 3 já recebeu a do mês');

    clock = new Date('2026-11-04T22:00:00Z');
    await notifyLogDocument(dependencies.db, ANA, '2026-11-02').delete();
    assert.equal((await run()).noContent, 1, 'depois do dia 3 não há retrospectiva');
  });

  test('idempotente: rodar de novo no mesmo dia não reenvia nem duplica', async () => {
    await prefsOfAna({ duel: true });
    await putEntry('e-speed', SPEED, 'Speed', 'a1');
    await putEntry('e-abyss', ABYSS, 'The Abyss', 'a2');

    assert.equal((await run()).sent, 1);
    clock = new Date('2026-10-18T22:40:00Z');
    const again = await run();

    assert.deepEqual([again.sent, again.alreadySent], [0, 1]);
    assert.equal(fcm.sent.length, 1);
    assert.equal((await dependencies.db.collection(`lists/${LIST}/feed`).get()).size, 1);
  });

  test('frequência: a cada 3 dias, quem recebeu anteontem fica sem', async () => {
    await prefsOfAna({ duel: true }, { freq: 3 });
    await putEntry('e-speed', SPEED, 'Speed', 'a1');
    await putEntry('e-abyss', ABYSS, 'The Abyss', 'a2');
    await notifyLogDocument(dependencies.db, ANA, '2026-10-16').set({
      type: 'daily.duel',
      listId: LIST,
      sentAt: new Date('2026-10-16T22:00:00Z'),
    });

    assert.equal((await run()).frequency, 1);
    clock = new Date('2026-10-19T22:00:00Z');
    assert.equal((await run()).sent, 1);
  });

  test('fuso: a rotina das 21h roda às 00:00 UTC e usa o dia anterior de Brasília', async () => {
    await prefsOfAna({ duel: true }, { hour: 21 });
    await putEntry('e-speed', SPEED, 'Speed', 'a1');
    await putEntry('e-abyss', ABYSS, 'The Abyss', 'a2');
    clock = new Date('2026-10-19T00:20:00Z');

    const report = await run(notify21CronRoute);

    assert.deepEqual([report.day, report.sent], ['2026-10-18', 1]);
    assert.ok((await notifyLogDocument(dependencies.db, ANA, '2026-10-18').get()).exists);
    assert.ok(await feedItem(`daily-${ANA}-2026-10-18`));
  });

  test('só quem escolheu o horário; desligado (freq 0) fica de fora', async () => {
    await prefsOfAna({ duel: true }, { hour: 9 });
    await putEntry('e-speed', SPEED, 'Speed', 'a1');
    await putEntry('e-abyss', ABYSS, 'The Abyss', 'a2');

    assert.equal((await run()).people, 0);
    clock = new Date('2026-10-18T12:00:00Z');
    assert.equal((await run(notify09CronRoute)).sent, 1);

    await prefsOfAna({ duel: true }, { hour: 9, freq: 0 });
    clock = new Date('2026-10-19T12:00:00Z');
    assert.equal((await run(notify09CronRoute)).people, 0);
  });

  test('aparelho de quem nunca gravou preferências recebe às 19h, com o padrão', async () => {
    await deviceTokenDocument(dependencies.db, BIA, 'token-bia').set({
      token: 'token-bia',
      platform: 'android',
      updatedAt: clock,
    });
    await putEntry('e-speed', SPEED, 'Speed', 'a1');
    await putEntry('e-abyss', ABYSS, 'The Abyss', 'a2');

    const report = await run();
    assert.equal(report.people, 2, 'Ana (aparelho, sem preferências) e Bia');
    assert.ok(await feedItem(`daily-${BIA}-2026-10-18`));
    assert.ok(fcm.sent.some((message) => message.tokens.includes('token-bia')));
  });

  test('sem segredo do cron: 401', async () => {
    const response = await notify19CronRoute(() => dependencies)(new Request('http://localhost/api/cron/notify-19'));
    assert.equal(response.status, 401);
  });
});
