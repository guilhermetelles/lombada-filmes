import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FALLBACK_TOPICS, PRIORITY_TOPICS, topicOrder } from '../../lib/daily/choose-daily-content.js';
import { composeCurio } from '../../lib/daily/topics/curio-topic.js';
import { composeDuel } from '../../lib/daily/topics/duel-topic.js';
import { composeMemory } from '../../lib/daily/topics/memory-topic.js';
import { composeMilestone } from '../../lib/daily/topics/milestone-topic.js';
import { composeReleaseAnniversary } from '../../lib/daily/topics/release-anniversary-topic.js';
import { DEFAULT_NOTIFY_PREFS } from '../../lib/notify/default-notify-prefs.js';
import { offlineContext, sampleList, sampleMovie } from './daily-samples.js';

/** Filmes das amostras (ids reais do TMDb). */
const SPEED = 1637;
const ABYSS = 2756;
const TWISTER = 664;
const HEAT = 949;

describe('comentário do dia', () => {
  test('aniversário de 1 ano do dia em que viram vem primeiro, com o comentário verbatim', async () => {
    const list = sampleList([
      {
        entryId: 'e-speed',
        tmdbId: SPEED,
        title: 'Speed',
        watchedOn: '2025-10-20',
        comment: 'Ônibus que não pode parar.',
      },
      { entryId: 'e-abyss', tmdbId: ABYSS, title: 'The Abyss', watchedOn: '2024-01-10', comment: 'Fundo do mar.' },
      { entryId: 'e-novo', tmdbId: TWISTER, title: 'Twister', watchedOn: '2026-10-01', comment: 'Visto há pouco.' },
    ]);

    assert.deepEqual(await composeMemory(offlineContext(list, '2026-10-18')), {
      type: 'daily.memory',
      title: 'Há 1 ano, sobre Speed',
      body: 'Visto em 20/10/2025; hoje em #1 na lista.',
      quote: 'Ônibus que não pode parar.',
      route: { name: 'memory', args: { entryId: 'e-speed' } },
    });
  });

  test('sem aniversário, o mais antigo (o sorteio do dia mexe em até 120 dias)', async () => {
    const list = sampleList([
      { entryId: 'e-recente', tmdbId: SPEED, title: 'Speed', watchedOn: '2026-05-01', comment: 'Ônibus.' },
      { entryId: 'e-abyss', tmdbId: ABYSS, title: 'The Abyss', watchedOn: '2024-01-10', comment: 'Fundo do mar.' },
    ]);

    const content = await composeMemory(offlineContext(list, '2026-10-18'));
    assert.equal(content?.title, 'Há 33 meses, sobre The Abyss');
    assert.equal(content?.quote, 'Fundo do mar.');
  });

  test('sem comentário ou visto há menos de 30 dias: nada', async () => {
    const list = sampleList([
      { entryId: 'e-1', tmdbId: SPEED, title: 'Speed', watchedOn: '2025-10-20' },
      { entryId: 'e-2', tmdbId: ABYSS, title: 'The Abyss', watchedOn: '2026-10-01', comment: 'Recente.' },
    ]);
    assert.equal(await composeMemory(offlineContext(list, '2026-10-18')), null);
  });
});

describe('curiosidade', () => {
  const abyssList = (extra: Parameters<typeof sampleMovie>[1]) =>
    sampleList(
      [{ entryId: 'e-abyss', tmdbId: ABYSS, title: 'The Abyss' }],
      new Map([[ABYSS, sampleMovie('The Abyss', extra)]]),
    );

  test('orçamento e bilheteria', async () => {
    const content = await composeCurio(
      offlineContext(abyssList({ budget: 69_500_000, revenue: 90_000_000 }), '2026-10-18'),
    );
    assert.deepEqual(content, {
      type: 'daily.curio',
      title: 'Você sabia?',
      body: 'The Abyss custou US$ 69,5 milhões e faturou US$ 90 milhões no mundo.',
      route: { name: 'movie', args: { tmdbId: ABYSS } },
    });
  });

  test('bilheteria menor que o orçamento: "só faturou"', async () => {
    const content = await composeCurio(
      offlineContext(abyssList({ budget: 2_000_000_000, revenue: 850_000 }), '2026-10-18'),
    );
    assert.equal(content?.body, 'The Abyss custou US$ 2 bilhões e só faturou US$ 850 mil no mundo.');
  });

  test('título no Brasil diferente do original', async () => {
    const content = await composeCurio(offlineContext(abyssList({ titlePt: 'O Segredo do Abismo' }), '2026-10-18'));
    assert.equal(content?.body, 'No Brasil, The Abyss se chamou O Segredo do Abismo.');
  });

  test('prêmio vencido, o Oscar antes dos outros', async () => {
    const awards = {
      items: [
        { org: 'Saturn', cat: 'Melhor Filme de Ficção Científica', kind: 'win' as const, year: 1990 },
        { org: 'Oscar', cat: 'Efeitos Visuais', kind: 'win' as const, year: 1990 },
        { org: 'Oscar', cat: 'Fotografia', kind: 'nom' as const, year: 1990 },
      ],
      summary: null,
      fetchedAt: new Date('2026-10-01T12:00:00Z'),
    };
    const content = await composeCurio(offlineContext(abyssList({ awards }), '2026-10-18'));
    assert.equal(content?.body, 'The Abyss ganhou o prêmio Oscar de Efeitos Visuais em 1990.');
  });

  test('sem esses dados nos filmes: nada', async () => {
    assert.equal(await composeCurio(offlineContext(abyssList({ titlePt: 'the abyss' }), '2026-10-18')), null);
  });
});

describe('duelo', () => {
  test('duas entradas vizinhas', async () => {
    const list = sampleList([
      { entryId: 'e-speed', tmdbId: SPEED, title: 'Speed' },
      { entryId: 'e-abyss', tmdbId: ABYSS, title: 'The Abyss' },
    ]);
    assert.deepEqual(await composeDuel(offlineContext(list, '2026-10-18')), {
      type: 'daily.duel',
      title: 'Duelo de revisão',
      body: 'Vocês ainda acham que Speed (#1) é melhor que The Abyss (#2)?',
      route: { name: 'duel', args: { entryId: 'e-speed', entryIdB: 'e-abyss' } },
    });
  });

  test('o mesmo dia sorteia o mesmo par; menos de dois filmes, nada', async () => {
    const entries = [SPEED, ABYSS, TWISTER, HEAT].map((tmdbId) => ({
      entryId: `e-${tmdbId}`,
      tmdbId,
      title: `${tmdbId}`,
    }));
    const list = sampleList(entries);
    const first = await composeDuel(offlineContext(list, '2026-10-18'));
    assert.deepEqual(await composeDuel(offlineContext(list, '2026-10-18')), first);
    assert.equal(await composeDuel(offlineContext(sampleList(entries.slice(0, 1)), '2026-10-18')), null);
  });
});

describe('marco', () => {
  const now = new Date('2026-10-18T22:00:00Z');
  const old = new Date('2026-09-01T12:00:00Z');
  const recent = new Date('2026-10-16T12:00:00Z');

  test('a décima entrada desta semana: "chegaram a 10 filmes"', async () => {
    const entries = Array.from({ length: 10 }, (_, index) => ({
      entryId: `e-${index}`,
      tmdbId: 100 + index,
      title: `Filme ${index}`,
      watchedOn: `2025-02-${String(index + 1).padStart(2, '0')}`,
      createdAt: index === 9 ? recent : old,
    }));
    const movies = new Map(entries.map((entry) => [entry.tmdbId, sampleMovie(entry.title, { runtime: 100 })]));

    assert.deepEqual(await composeMilestone(offlineContext(sampleList(entries, movies), '2026-10-18', now)), {
      type: 'daily.milestone',
      title: 'Vocês chegaram a 10 filmes',
      body: 'São 10 filmes e 17 horas de filme juntos desde 01/02/2025.',
      route: { name: 'reports' },
    });
  });

  test('horas: passou de 50 horas com o filme desta semana', async () => {
    const entries = [0, 1, 2, 3].map((index) => ({
      entryId: `e-${index}`,
      tmdbId: 200 + index,
      title: `Filme ${index}`,
      createdAt: index === 3 ? recent : old,
    }));
    const movies = new Map(
      entries.map((entry, index) => [entry.tmdbId, sampleMovie(entry.title, { runtime: index === 3 ? 180 : 960 })]),
    );
    const content = await composeMilestone(offlineContext(sampleList(entries, movies), '2026-10-18', now));
    assert.equal(content?.title, 'Vocês passaram de 50 horas de filme');
    assert.equal(content?.body, 'São 4 filmes e 51 horas de filme juntos.');
  });

  test('nenhum número redondo passado nesta semana: nada', async () => {
    const entries = Array.from({ length: 11 }, (_, index) => ({
      entryId: `e-${index}`,
      tmdbId: 300 + index,
      title: `Filme ${index}`,
      createdAt: index === 10 ? recent : old,
    }));
    assert.equal(await composeMilestone(offlineContext(sampleList(entries), '2026-10-18', now)), null);
  });
});

describe('aniversário de estreia', () => {
  test('ontem: "fez 37 anos de estreia ontem"', async () => {
    const list = sampleList(
      [
        { entryId: 'e-speed', tmdbId: SPEED, title: 'Speed' },
        { entryId: 'e-abyss', tmdbId: ABYSS, title: 'The Abyss' },
      ],
      new Map(),
      new Map([
        [SPEED, '1994-06-10'],
        [ABYSS, '1989-08-09'],
      ]),
    );
    assert.deepEqual(await composeReleaseAnniversary(offlineContext(list, '2026-08-10')), {
      type: 'daily.releaseAnniversary',
      title: 'The Abyss fez 37 anos de estreia ontem',
      body: 'Lançado em 09/08/1989; está em #2 na lista de vocês.',
      route: { name: 'movie', args: { tmdbId: ABYSS } },
    });
  });

  test('daqui a alguns dias e na virada do ano', async () => {
    const list = sampleList(
      [{ entryId: 'e-1', tmdbId: SPEED, title: 'Speed' }],
      new Map(),
      new Map([[SPEED, '1990-01-02']]),
    );
    const content = await composeReleaseAnniversary(offlineContext(list, '2026-12-29'));
    assert.equal(content?.title, 'Speed faz 37 anos de estreia em 02/01');
  });

  test('fora da semana, ou sem data de estreia guardada: nada', async () => {
    const list = sampleList(
      [{ entryId: 'e-1', tmdbId: SPEED, title: 'Speed' }],
      new Map(),
      new Map([[SPEED, '1994-06-10']]),
    );
    assert.equal(await composeReleaseAnniversary(offlineContext(list, '2026-10-18')), null);
    assert.equal(
      await composeReleaseAnniversary(
        offlineContext(sampleList([{ entryId: 'e-1', tmdbId: 1, title: 'X' }]), '2026-10-18'),
      ),
      null,
    );
  });
});

describe('ordem dos assuntos', () => {
  test('tudo ligado: data certa primeiro, depois o assunto do dia e o resto na ordem de recurso', () => {
    const order = topicOrder(DEFAULT_NOTIFY_PREFS.types, 'ana', '2026-10-18');
    assert.deepEqual(order.slice(0, 2), [...PRIORITY_TOPICS]);
    assert.equal(new Set(order).size, order.length);
    assert.equal(order.length, PRIORITY_TOPICS.length + FALLBACK_TOPICS.length);
    const rest = order.slice(3);
    assert.deepEqual(
      rest,
      FALLBACK_TOPICS.filter((topic) => topic !== order[2]),
    );
  });

  test('o assunto do dia é o mesmo ao rodar de novo e muda com o dia', () => {
    const days = ['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'];
    const topics = days.map((day) => topicOrder(DEFAULT_NOTIFY_PREFS.types, 'ana', day)[2]);
    assert.deepEqual(
      days.map((day) => topicOrder(DEFAULT_NOTIFY_PREFS.types, 'ana', day)[2]),
      topics,
    );
    assert.ok(new Set(topics).size > 1);
  });

  test('só os ligados; aniversário desligado tira os dois aniversários', () => {
    const types = { ...DEFAULT_NOTIFY_PREFS.types, birthday: false, retro: false, streaming: false, release: false };
    const order = topicOrder(types, 'ana', '2026-10-18');
    assert.deepEqual([...order].sort(), ['curio', 'duel', 'memory', 'milestone', 'quiz']);

    const onlyMemory = Object.fromEntries(Object.keys(types).map((key) => [key, key === 'memory']));
    assert.deepEqual(topicOrder({ ...types, ...onlyMemory }, 'ana', '2026-10-18'), ['memory']);
  });
});
