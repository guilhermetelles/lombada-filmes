import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { GeneratedQuiz, QuizGeneratorContext } from '../../lib/quiz/build-question.js';
import { generateDailyQuiz, QUIZ_GENERATORS } from '../../lib/quiz/generate-daily-quiz.js';
import type { ListMaterial } from '../../lib/quiz/list-material.js';
import { monthLabel, movieLabel } from '../../lib/quiz/quiz-text.js';
import { createSeededRandom } from '../../lib/quiz/seeded-random.js';
import type { QuizType } from '../../lib/types/quiz.js';
import type { GeminiClient } from '../../lib/types/sources.js';
import { createFakeGemini } from '../support/fake-gemini.js';
import { countingUsage, SAMPLE_FILMS, type SampleFilm, sampleMaterial } from './quiz-samples.js';

/** Dia dos testes. */
const DAY = '2026-10-18';

/** Seeds diferentes, para cada gerador ser exercitado com vários sorteios. */
const SEEDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

/**
 * Monta o contexto de um gerador.
 *
 * @param seed - Semente do sorteio.
 * @param overrides - Material e Gemini do teste.
 * @returns O contexto.
 */
function context(
  seed: string,
  overrides: { material?: ListMaterial; gemini?: GeminiClient } = {},
): QuizGeneratorContext {
  return {
    material: overrides.material ?? sampleMaterial(),
    random: createSeededRandom(seed),
    day: DAY,
    gemini: overrides.gemini ?? createFakeGemini().client,
    usage: countingUsage(),
  };
}

/**
 * Roda um gerador e exige uma pergunta.
 *
 * @param type - Tipo.
 * @param ctx - Contexto.
 * @returns A pergunta.
 */
async function generate(type: QuizType, ctx: QuizGeneratorContext): Promise<GeneratedQuiz> {
  const quiz = await QUIZ_GENERATORS[type](ctx);
  assert.ok(quiz, `${type} devia gerar uma pergunta`);
  assertWellFormed(quiz, type);
  return quiz;
}

/**
 * Confere o formato comum: 4 alternativas a–d, sem rótulo repetido, e uma certa entre elas.
 *
 * @param quiz - Pergunta.
 * @param type - Tipo esperado.
 */
function assertWellFormed(quiz: GeneratedQuiz, type: QuizType): void {
  assert.equal(quiz.type, type);
  assert.deepEqual(
    quiz.options.map((option) => option.id),
    ['a', 'b', 'c', 'd'],
  );
  assert.equal(new Set(quiz.options.map((option) => option.label)).size, 4);
  assert.ok(quiz.options.some((option) => option.id === quiz.rightOptionId));
  assert.ok(quiz.prompt.length > 0 && quiz.explanation.length > 0);
}

/**
 * Rótulo da alternativa certa.
 *
 * @param quiz - Pergunta.
 * @returns O rótulo.
 */
function rightLabel(quiz: GeneratedQuiz): string {
  return quiz.options.find((option) => option.id === quiz.rightOptionId)?.label ?? '';
}

/**
 * Rótulos das alternativas erradas.
 *
 * @param quiz - Pergunta.
 * @returns Os rótulos.
 */
function wrongLabels(quiz: GeneratedQuiz): string[] {
  return quiz.options.filter((option) => option.id !== quiz.rightOptionId).map((option) => option.label);
}

/**
 * Acha o filme de teste pelo rótulo "Título (ano)".
 *
 * @param label - Rótulo.
 * @returns O filme.
 */
function filmByLabel(label: string): SampleFilm {
  const film = SAMPLE_FILMS.find((sample) => movieLabel(sample.movie) === label);
  assert.ok(film, `filme não encontrado: ${label}`);
  return film;
}

/**
 * Acha o filme de teste citado no enunciado (pelo título).
 *
 * @param prompt - Enunciado.
 * @returns O filme.
 */
function filmInPrompt(prompt: string): SampleFilm {
  const film = [...SAMPLE_FILMS]
    .sort((a, b) => b.movie.title.length - a.movie.title.length)
    .find((sample) => prompt.includes(sample.movie.title));
  assert.ok(film, `nenhum filme no enunciado: ${prompt}`);
  return film;
}

/**
 * Gemini falso que responde sempre com o mesmo valor (ou com uma função do texto enviado).
 *
 * @param reply - Resposta, ou função que a calcula a partir do texto.
 * @returns O cliente e os textos recebidos.
 */
function geminiReplying(reply: unknown | ((prompt: string) => unknown)): { client: GeminiClient; prompts: string[] } {
  const prompts: string[] = [];
  const client: GeminiClient = {
    async generateJson({ prompt, schema }) {
      prompts.push(prompt);
      return schema.parse(typeof reply === 'function' ? reply(prompt) : reply);
    },
  };
  return { client, prompts };
}

/**
 * Material só com um comentário (os outros ficam vazios), para saber qual entrada o trecho usa.
 *
 * @param tmdbId - Filme que fica com comentário.
 * @param comment - Comentário dele (sem mudança, o da amostra).
 * @returns O material.
 */
function materialWithOneComment(tmdbId: number, comment?: string): ListMaterial {
  return sampleMaterial(
    SAMPLE_FILMS.map((film) =>
      film.tmdbId === tmdbId ? { ...film, comment: comment ?? film.comment } : { ...film, comment: '' },
    ),
  );
}

describe('geradores do quiz', () => {
  test('diretor: certo é quem dirigiu o filme do enunciado; erradas são diretores de outros filmes', async () => {
    for (const seed of SEEDS) {
      const quiz = await generate('diretor', context(seed));
      const film = filmInPrompt(quiz.prompt);
      const own = film.movie.directors.map((director) => director.name);
      assert.equal(rightLabel(quiz), own[0]);
      const others = SAMPLE_FILMS.flatMap((sample) => sample.movie.directors.map((director) => director.name));
      for (const label of wrongLabels(quiz)) {
        assert.ok(!own.includes(label) && others.includes(label), label);
      }
    }
  });

  test('ano: certo é o ano do filme; erradas a até 4 anos e nunca depois do ano corrente', async () => {
    for (const seed of SEEDS) {
      const quiz = await generate('ano', context(seed));
      const year = filmInPrompt(quiz.prompt).movie.year ?? 0;
      assert.equal(rightLabel(quiz), String(year));
      for (const label of wrongLabels(quiz)) {
        const distance = Math.abs(Number(label) - year);
        assert.ok(distance >= 1 && distance <= 4 && Number(label) <= 2026, label);
      }
    }
  });

  test('ano: filme do ano corrente só tem anos anteriores nas erradas', async () => {
    const recent = SAMPLE_FILMS.map((film) => ({ ...film, movie: { ...film.movie, year: 2026 } }));
    const quiz = await generate('ano', context('a', { material: sampleMaterial(recent) }));
    assert.ok(wrongLabels(quiz).every((label) => Number(label) < 2026));
  });

  test('trecho: o Gemini devolve posições e o trecho sai verbatim, com o título escondido', async () => {
    const gemini = geminiReplying((prompt: string) => {
      const sentence = 'Abyss merece mais carinho do que recebe.';
      return { start: prompt.indexOf(sentence), end: prompt.indexOf(sentence) + sentence.length };
    });
    const quiz = await generate(
      'trecho',
      context('a', { material: materialWithOneComment(2756), gemini: gemini.client }),
    );

    assert.equal(quiz.media?.excerpt, '▇▇▇ merece mais carinho do que recebe.');
    assert.equal(rightLabel(quiz), 'The Abyss (1989)');
    assert.match(quiz.explanation, /The Abyss, #1 no ranking, visto em 05\/09\/2026/);
    assert.equal(gemini.prompts.length, 1);
  });

  test('trecho: posições no meio de palavras são ajustadas para palavras inteiras', async () => {
    const gemini = geminiReplying((prompt: string) => {
      const start = prompt.indexOf('A cena do rato') + 3;
      return { start, end: prompt.indexOf('assusta a gente.') + 12 };
    });
    const quiz = await generate(
      'trecho',
      context('a', { material: materialWithOneComment(2756), gemini: gemini.client }),
    );
    assert.equal(quiz.media?.excerpt, 'cena do rato respirando líquido ainda assusta a gente');
  });

  test('trecho: os nomes dos membros não vão ao Gemini e trecho com nome trocado é recusado', async () => {
    const comment = 'A Ana dormiu no meio e acordou bem na hora da explosão final, rindo muito.';
    const gemini = geminiReplying((prompt: string) => ({ start: 0, end: prompt.length }));
    const quiz = await generate(
      'trecho',
      context('a', { material: materialWithOneComment(2756, comment), gemini: gemini.client }),
    );

    assert.ok(!gemini.prompts[0]?.includes('Ana'), 'o nome sai antes de ir ao Gemini');
    assert.ok(gemini.prompts[0]?.includes('[nome]'));
    // A regra simples escolhe a frase verbatim do comentário original.
    assert.equal(quiz.media?.excerpt, comment);
  });

  test('trecho: Gemini fora do ar usa uma frase do comentário, verbatim', async () => {
    const quiz = await generate('trecho', context('b', { material: materialWithOneComment(2756) }));
    const masked = SAMPLE_FILMS[0]?.comment.replace('Abyss', '▇▇▇') ?? '';
    assert.ok(quiz.media?.excerpt && masked.includes(quiz.media.excerpt), quiz.media?.excerpt);
  });

  test('trecho: sem comentário longo o bastante, não há pergunta', async () => {
    const material = sampleMaterial(SAMPLE_FILMS.map((film) => ({ ...film, comment: 'curto' })));
    assert.equal(await QUIZ_GENERATORS.trecho(context('a', { material })), undefined);
  });

  test('pôster: mostra o pôster do filme certo, com recorte dentro do pôster', async () => {
    for (const seed of SEEDS) {
      const quiz = await generate('poster', context(seed));
      const film = filmByLabel(rightLabel(quiz));
      assert.equal(quiz.media?.posterPath, film.movie.posterPath);
      const crop = quiz.media?.crop;
      assert.ok(crop && crop.x >= 0.15 && crop.x <= 0.85 && crop.y >= 0.15 && crop.y <= 0.6 && crop.zoom === 3);
    }
  });

  test('ranking: certo é o de melhor posição entre as quatro', async () => {
    const ranks = new Map(SAMPLE_FILMS.map((film, index) => [movieLabel(film.movie), index + 1]));
    for (const seed of SEEDS) {
      const quiz = await generate('ranking', context(seed));
      const best = Math.min(...quiz.options.map((option) => ranks.get(option.label) ?? 99));
      assert.equal(ranks.get(rightLabel(quiz)), best);
    }
  });

  test('mês: certo é o mês registrado; errados a até 6 meses e nunca depois do mês corrente', async () => {
    for (const seed of SEEDS) {
      const quiz = await generate('mes', context(seed));
      const film = filmInPrompt(quiz.prompt);
      assert.equal(rightLabel(quiz), monthLabel(film.watchedOn?.slice(0, 7) ?? ''));
      assert.ok(!quiz.options.some((option) => option.label.endsWith('novembro de 2026')));
    }
  });

  test('personagem: certo é quem fez o papel, com a foto do TMDb', async () => {
    const quiz = await generate('personagem', context('a'));
    const cast = SAMPLE_FILMS[0]?.movie.cast ?? [];
    const right = quiz.options.find((option) => option.id === quiz.rightOptionId);
    const member = cast.find((person) => person.name === right?.label);
    assert.ok(member?.character && quiz.prompt.includes(member.character));
    assert.equal(right?.imageUrl, member.profilePath ? `https://image.tmdb.org/t/p/w185${member.profilePath}` : null);
    assert.ok(quiz.options.every((option) => cast.some((person) => person.name === option.label)));
  });

  test('personagem: sem 4 pessoas com personagem nos filmes do topo, não há pergunta', async () => {
    const material = sampleMaterial(SAMPLE_FILMS.map((film) => ({ ...film, movie: { ...film.movie, cast: [] } })));
    assert.equal(await QUIZ_GENERATORS.personagem(context('a', { material })), undefined);
  });

  test('emoji: usa os emojis do Gemini, gerados a partir da sinopse', async () => {
    const gemini = geminiReplying({ emoji: ' 🌊🛢️👽💍 ' });
    const quiz = await generate('emoji', context('a', { gemini: gemini.client }));
    assert.equal(quiz.media?.emoji, '🌊🛢️👽💍');
    const film = filmByLabel(rightLabel(quiz));
    assert.ok(gemini.prompts[0]?.includes(film.movie.synopsis.pt ?? '-'));
    assert.match(quiz.explanation, /^Os emojis contam /);
  });

  test('emoji: resposta com letras ou Gemini fora do ar não geram pergunta', async () => {
    assert.equal(
      await QUIZ_GENERATORS.emoji(context('a', { gemini: geminiReplying({ emoji: '🌊 mar' }).client })),
      undefined,
    );
    assert.equal(await QUIZ_GENERATORS.emoji(context('a')), undefined);
  });

  test('sinopse: usa a sinopse sem nomes do Gemini', async () => {
    const synopsis = 'Um ex-religioso encontra marcas estranhas na plantação da família, sem saber quem as fez.';
    const quiz = await generate('sinopse', context('a', { gemini: geminiReplying({ synopsis }).client }));
    assert.equal(quiz.media?.synopsis, synopsis);
  });

  test('sinopse: resposta com o título ou com nome do elenco é recusada', async () => {
    const material = sampleMaterial(SAMPLE_FILMS.slice(0, 1).concat(SAMPLE_FILMS.slice(3, 6)));
    const withName = 'Ed Harris lidera mergulhadores que ajudam a resgatar um submarino nuclear no fundo do mar.';
    const withTitle = 'Mergulhadores descem ao abismo para resgatar um submarino nuclear: O Segredo do Abismo começa.';
    for (const synopsis of [withName, withTitle]) {
      // Só o primeiro filme tem sinopse, então o sorteio sempre cai nele.
      const quiz = await QUIZ_GENERATORS.sinopse(
        context('a', { material, gemini: geminiReplying({ synopsis }).client }),
      );
      assert.equal(quiz, undefined, synopsis);
    }
  });

  test('bechdel: as quatro notas na ordem fixa e a certa é a do site', async () => {
    for (const seed of SEEDS) {
      const quiz = await generate('bechdel', context(seed));
      assert.deepEqual(
        quiz.options.map((option) => option.label),
        ['Passa nos 3 critérios', '2 de 3', '1 de 3', 'Nenhum'],
      );
      const rating = filmInPrompt(quiz.prompt).movie.bechdel?.rating ?? -1;
      assert.equal(rightLabel(quiz), ['Nenhum', '1 de 3', '2 de 3', 'Passa nos 3 critérios'][rating]);
      assert.match(quiz.explanation, /bechdeltest\.com/);
    }
  });

  test('bilheteria: certo é o de maior orçamento entre as quatro', async () => {
    for (const seed of SEEDS) {
      const quiz = await generate('bilheteria', context(seed));
      const budget = (label: string) => filmByLabel(label).movie.budget ?? 0;
      assert.ok(wrongLabels(quiz).every((label) => budget(label) < budget(rightLabel(quiz))));
    }
  });

  test('prêmio: certo ganhou o prêmio; os outros sabidamente não têm nem indicação', async () => {
    for (const seed of SEEDS) {
      const quiz = await generate('premio', context(seed));
      const org = quiz.prompt.includes('Oscar') ? 'Oscar' : 'Framboesa de Ouro';
      const items = (label: string) => filmByLabel(label).movie.awards?.items ?? [];
      assert.ok(items(rightLabel(quiz)).some((item) => item.org === org && item.kind === 'win'));
      for (const label of wrongLabels(quiz)) {
        assert.ok(filmByLabel(label).movie.awards && !items(label).some((item) => item.org === org), label);
      }
    }
  });

  test('prêmio: filmes sem prêmios buscados não viram alternativa errada', async () => {
    const material = sampleMaterial(
      SAMPLE_FILMS.map((film) =>
        film.movie.awards?.items.length ? film : { ...film, movie: { ...film.movie, awards: undefined } },
      ),
    );
    assert.equal(await QUIZ_GENERATORS.premio(context('a', { material })), undefined);
  });

  test('tipos sem dados devolvem undefined em vez de pergunta pela metade', async () => {
    const bare = sampleMaterial(
      SAMPLE_FILMS.map((film) => ({
        ...film,
        comment: '',
        watchedOn: null,
        movie: { ...film.movie, budget: null, awards: undefined, bechdel: undefined, cast: [], directors: [] },
      })),
    );
    for (const type of ['diretor', 'mes', 'bechdel', 'bilheteria', 'premio', 'personagem', 'trecho'] as const) {
      assert.equal(await QUIZ_GENERATORS[type](context('a', { material: bare })), undefined, type);
    }
  });
});

describe('generateDailyQuiz', () => {
  test('mesma lista e mesmo dia dão a mesma pergunta', async () => {
    const request = { material: sampleMaterial(), day: DAY, usage: countingUsage() };
    const first = await generateDailyQuiz({ ...request, gemini: createFakeGemini().client });
    const second = await generateDailyQuiz({ ...request, gemini: createFakeGemini().client });
    assert.ok(first);
    assert.deepEqual(first, second);
  });

  test('dias diferentes variam o tipo', async () => {
    const types = new Set<string>();
    for (let day = 1; day <= 20; day++) {
      const quiz = await generateDailyQuiz({
        material: sampleMaterial(),
        day: `2026-10-${String(day).padStart(2, '0')}`,
        gemini: createFakeGemini().client,
        usage: countingUsage(),
      });
      types.add(quiz?.type ?? 'nenhum');
    }
    assert.ok(types.size >= 5, [...types].join(', '));
  });

  test('com o Gemini fora do ar, sorteia entre os tipos que não dependem dele', async () => {
    for (let day = 1; day <= 10; day++) {
      const quiz = await generateDailyQuiz({
        material: sampleMaterial(),
        day: `2026-10-${String(day).padStart(2, '0')}`,
        gemini: createFakeGemini().client,
        usage: countingUsage(),
      });
      assert.ok(quiz && quiz.type !== 'emoji' && quiz.type !== 'sinopse', quiz?.type);
    }
  });

  test('tipos recentes vão para o fim: o único tipo não recente com dados é o escolhido', async () => {
    const allTypes = Object.keys(QUIZ_GENERATORS) as QuizType[];
    const quiz = await generateDailyQuiz({
      material: sampleMaterial(),
      day: DAY,
      gemini: createFakeGemini().client,
      usage: countingUsage(),
      recentTypes: allTypes.filter((type) => type !== 'bechdel'),
    });
    assert.equal(quiz?.type, 'bechdel');
  });
});
