import type {
  CollectionReference,
  DocumentData,
  DocumentReference,
  Firestore,
  FirestoreDataConverter,
} from 'firebase-admin/firestore';
import { withoutUndefined } from '../firestore/without-undefined.js';
import { QuizAnswerSchema, QuizDocSchema, QuizKeySchema, ScoresSchema } from '../schemas/quiz.js';
import type { QuizAnswer, QuizDoc, QuizKey, Scores } from '../types/quiz.js';

/** Pontos de cada acerto no placar do mês. */
export const POINTS_PER_HIT = 10;

/**
 * Cria um conversor que valida ao ler e, ao gravar, tira os campos opcionais ausentes.
 *
 * @param parse - Validação do documento lido.
 * @returns O conversor.
 */
function converter<T extends DocumentData>(parse: (data: unknown) => T): FirestoreDataConverter<T> {
  return {
    toFirestore: (value) => withoutUndefined(value),
    fromFirestore: (snapshot) => parse(snapshot.data()),
  };
}

/** Conversor de quizzes/{dia}. */
const quizConverter = converter<QuizDoc>((data) => QuizDocSchema.parse(data));
/** Conversor de quizKeys/{dia}. */
const quizKeyConverter = converter<QuizKey>((data) => QuizKeySchema.parse(data));
/** Conversor de answers/{uid}. */
const answerConverter = converter<QuizAnswer>((data) => QuizAnswerSchema.parse(data));
/** Conversor de scores/{mês}. */
const scoresConverter = converter<Scores>((data) => ScoresSchema.parse(data));

/**
 * Referência a lists/{listId}/quizzes/{dia}: a pergunta pública do dia.
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @param day - Dia como AAAA-MM-DD.
 * @returns A referência tipada.
 */
export function quizDocument(db: Firestore, listId: string, day: string): DocumentReference<QuizDoc> {
  return db.doc(`lists/${listId}/quizzes/${day}`).withConverter(quizConverter);
}

/**
 * Referência a lists/{listId}/quizKeys/{dia}: o gabarito, que só o backend lê.
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @param day - Dia como AAAA-MM-DD.
 * @returns A referência tipada.
 */
export function quizKeyDocument(db: Firestore, listId: string, day: string): DocumentReference<QuizKey> {
  return db.doc(`lists/${listId}/quizKeys/${day}`).withConverter(quizKeyConverter);
}

/**
 * Coleção lists/{listId}/quizzes/{dia}/answers: uma resposta por membro.
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @param day - Dia como AAAA-MM-DD.
 * @returns A coleção tipada.
 */
export function answersCollection(db: Firestore, listId: string, day: string): CollectionReference<QuizAnswer> {
  return db.collection(`lists/${listId}/quizzes/${day}/answers`).withConverter(answerConverter);
}

/**
 * Referência a lists/{listId}/scores/{mês}: pontos do mês e vencedores.
 *
 * @param db - Firestore.
 * @param listId - Lista.
 * @param month - Mês como AAAA-MM.
 * @returns A referência tipada.
 */
export function scoresDocument(db: Firestore, listId: string, month: string): DocumentReference<Scores> {
  return db.doc(`lists/${listId}/scores/${month}`).withConverter(scoresConverter);
}
