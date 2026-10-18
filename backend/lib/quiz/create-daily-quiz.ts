import { writeFeedItem } from '../feed/write-feed-item.js';
import { DAY_MS } from '../time/durations.js';
import type { Dependencies } from '../types/dependencies.js';
import type { QuizDoc, QuizType } from '../types/quiz.js';
import type { UsageRecorder } from '../types/usage.js';
import { generateDailyQuiz } from './generate-daily-quiz.js';
import type { ListMaterial } from './list-material.js';
import { quizDocument, quizKeyDocument } from './quiz-repository.js';

/** Nome curto de cada tipo, como a aba Quiz mostra. */
export const QUIZ_TYPE_TITLES: Record<QuizType, string> = {
  diretor: 'Diretor',
  ano: 'Ano',
  trecho: 'Comentário',
  poster: 'Pôster',
  ranking: 'Ranking',
  mes: 'Quando vimos',
  personagem: 'Personagem',
  emoji: 'Emojis',
  sinopse: 'Sinopse',
  bechdel: 'Bechdel',
  bilheteria: 'Orçamento',
  premio: 'Prêmios',
};

/** Quantos dias para trás contam como "tipo recente", que fica para o fim do sorteio. */
const RECENT_DAYS = 3;

/** Tamanho máximo do texto do item da Atividade. */
const FEED_BODY_LIMIT = 120;

/** Resultado da rotina para uma lista: pergunta criada agora, que já existia ou sem dados. */
export type DailyQuizOutcome = 'created' | 'exists' | 'no-data';

/**
 * Cria a pergunta do dia da lista: quizzes/{dia} e quizKeys/{dia} juntos, numa transação que não faz
 * nada se a pergunta já existir (rodar de novo não troca a pergunta), e o item `daily.quiz` da
 * Atividade com id `quiz-{dia}`, também só uma vez.
 *
 * @param dependencies - Banco, Gemini e relógio.
 * @param usage - Medidor de consumo da rotina.
 * @param material - Entradas e filmes da lista.
 * @param day - Dia de Brasília (AAAA-MM-DD).
 * @returns O que aconteceu com a pergunta do dia.
 */
async function createDailyQuiz(
  { db, sources, now }: Dependencies,
  usage: UsageRecorder,
  material: ListMaterial,
  day: string,
): Promise<DailyQuizOutcome> {
  const { listId } = material;
  const quizRef = quizDocument(db, listId, day);
  const existing = (await quizRef.get()).data();
  if (existing) {
    await writeDailyQuizFeed(db, listId, existing, now());
    return 'exists';
  }

  const recentTypes = await readRecentTypes(db, listId, day);
  const generated = await generateDailyQuiz({ material, day, gemini: sources.gemini, usage, recentTypes });
  if (!generated) return 'no-data';

  const { rightOptionId, explanation, ...question } = generated;
  const quiz: QuizDoc = { day, ...question, createdAt: now() };
  const keyRef = quizKeyDocument(db, listId, day);
  const created = await db.runTransaction(async (transaction) => {
    if ((await transaction.get(quizRef)).exists) return false;
    transaction.create(quizRef, quiz);
    transaction.set(keyRef, { rightOptionId, explanation });
    return true;
  });

  const stored = created ? quiz : (await quizRef.get()).data();
  if (stored) await writeDailyQuizFeed(db, listId, stored, now());
  return created ? 'created' : 'exists';
}

/**
 * Lê os tipos das perguntas dos últimos dias.
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @param day - Dia de hoje (AAAA-MM-DD).
 * @returns Os tipos encontrados, do mais recente para o mais antigo.
 */
async function readRecentTypes(db: Dependencies['db'], listId: string, day: string): Promise<QuizType[]> {
  const noon = Date.parse(`${day}T12:00:00Z`);
  const days = Array.from({ length: RECENT_DAYS }, (_, index) =>
    new Date(noon - (index + 1) * DAY_MS).toISOString().slice(0, 10),
  );
  const snapshots = await Promise.all(days.map((previous) => quizDocument(db, listId, previous).get()));
  return snapshots.flatMap((snapshot) => {
    const type = snapshot.exists ? snapshot.get('type') : undefined;
    return typeof type === 'string' && type in QUIZ_TYPE_TITLES ? [type as QuizType] : [];
  });
}

/**
 * Grava o item `daily.quiz` da Atividade (id `quiz-{dia}`, uma vez só), com o tipo e o enunciado.
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @param quiz - Pergunta do dia.
 * @param createdAt - Momento da gravação.
 */
async function writeDailyQuizFeed(db: Dependencies['db'], listId: string, quiz: QuizDoc, createdAt: Date) {
  const body = quiz.prompt.length > FEED_BODY_LIMIT ? `${quiz.prompt.slice(0, FEED_BODY_LIMIT - 1)}…` : quiz.prompt;
  await writeFeedItem(
    db,
    listId,
    {
      type: 'daily.quiz',
      kind: 'quiz',
      createdAt,
      title: `Pergunta de hoje: ${QUIZ_TYPE_TITLES[quiz.type]}`,
      body,
      route: { name: 'quizPlay', args: { day: quiz.day } },
    },
    `quiz-${quiz.day}`,
  );
}

export { createDailyQuiz };
