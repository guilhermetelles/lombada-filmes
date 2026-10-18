/** Evento "Início de uso do app": 10 perguntas extras, uma vez só, que valem pontos como as do dia. */

/** Nome do evento, gravado em `event` nas perguntas. */
export const LAUNCH_EVENT = 'inicio';

/** Quantas perguntas o evento tem. */
export const LAUNCH_QUIZ_COUNT = 10;

/** Id de pergunta do evento: `inicio-01` a `inicio-10`. */
export const LAUNCH_QUIZ_ID = /^inicio-(0[1-9]|10)$/;

/**
 * Id do documento da pergunta N do evento.
 *
 * @param index - Posição, de 1 a 10.
 * @returns `inicio-01` a `inicio-10`.
 */
function launchQuizId(index: number): string {
  return `${LAUNCH_EVENT}-${String(index).padStart(2, '0')}`;
}

/**
 * Diz se o id é de uma pergunta do evento, que vale em qualquer dia.
 *
 * @param quizId - Id do documento em quizzes/.
 * @returns true para `inicio-01` a `inicio-10`.
 */
function isLaunchQuizId(quizId: string): boolean {
  return LAUNCH_QUIZ_ID.test(quizId);
}

export { isLaunchQuizId, launchQuizId };
