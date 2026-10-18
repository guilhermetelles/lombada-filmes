import { logger } from '../logging/logger.js';
import type { NotifyTypes } from '../types/notify.js';
import {
  type DailyComposer,
  type DailyContent,
  type DailyContext,
  type DailyList,
  type DailyTopic,
  TOPIC_PREFERENCE,
} from './daily-content.js';
import { pickSeeded } from './day-seed.js';
import { composeBirthday } from './topics/birthday-topic.js';
import { composeCurio } from './topics/curio-topic.js';
import { composeDuel } from './topics/duel-topic.js';
import { composeMemory } from './topics/memory-topic.js';
import { composeMilestone } from './topics/milestone-topic.js';
import { composeQuiz } from './topics/quiz-topic.js';
import { composeReleaseAnniversary } from './topics/release-anniversary-topic.js';
import { composeRelease } from './topics/release-topic.js';
import { composeRetro } from './topics/retro-topic.js';
import { composeStreaming } from './topics/streaming-topic.js';

/** Assuntos que só valem num dia certo e passam na frente quando têm conteúdo. */
export const PRIORITY_TOPICS: readonly DailyTopic[] = ['retro', 'streaming'];

/**
 * Assuntos do rodízio, na ordem de recurso do plano (quiz → comentário do dia → curiosidade →
 * duelo → marco → aniversários), com a estreia no fim por depender do TMDb.
 */
export const FALLBACK_TOPICS: readonly DailyTopic[] = [
  'quiz',
  'memory',
  'curio',
  'duel',
  'milestone',
  'releaseAnniversary',
  'birthday',
  'release',
];

/** Quem monta cada assunto. */
const COMPOSERS: Record<DailyTopic, DailyComposer> = {
  quiz: composeQuiz,
  memory: composeMemory,
  curio: composeCurio,
  duel: composeDuel,
  milestone: composeMilestone,
  releaseAnniversary: composeReleaseAnniversary,
  birthday: composeBirthday,
  release: composeRelease,
  streaming: composeStreaming,
  retro: composeRetro,
};

/**
 * Ordem em que os assuntos ligados são tentados para uma pessoa num dia: primeiro os de data certa
 * (retrospectiva, chegou no streaming), depois o assunto do dia (sorteado entre os ligados do
 * rodízio, com semente fixa pela pessoa e pelo dia) e, se ele não tiver conteúdo, os outros na
 * ordem de recurso.
 *
 * @param types - Assuntos que a pessoa ligou.
 * @param uid - Pessoa.
 * @param day - Dia de Brasília, AAAA-MM-DD.
 * @param excluded - Assuntos que ficam de fora, como o quiz, que tem aviso próprio.
 * @returns Os assuntos, sem repetição.
 */
function topicOrder(types: NotifyTypes, uid: string, day: string, excluded: readonly DailyTopic[] = []): DailyTopic[] {
  const enabled = (topic: DailyTopic) => types[TOPIC_PREFERENCE[topic]] && !excluded.includes(topic);
  const rotation = FALLBACK_TOPICS.filter(enabled);
  const topicOfDay = pickSeeded(rotation, `${day}:${uid}:assunto`);
  return [...new Set([...PRIORITY_TOPICS.filter(enabled), ...(topicOfDay ? [topicOfDay] : []), ...rotation])];
}

/** Conteúdo escolhido e a lista de onde ele saiu. */
export type ChosenContent = { content: DailyContent; list: DailyList };

/**
 * Escolhe a notificação do dia de uma pessoa: em cada lista dela, tenta os assuntos na ordem de
 * topicOrder até um ter conteúdo. Um assunto que falha só vai para o log e passa ao próximo.
 *
 * @param base - Dependências, consumo, pessoa, dia e momento.
 * @param lists - Listas da pessoa, já lidas.
 * @param types - Assuntos que a pessoa ligou.
 * @param excluded - Assuntos que ficam de fora.
 * @returns O conteúdo e a lista, ou null se nenhum assunto tiver o que dizer.
 */
async function chooseDailyContent(
  base: Omit<DailyContext, 'list'>,
  lists: readonly DailyList[],
  types: NotifyTypes,
  excluded: readonly DailyTopic[] = [],
): Promise<ChosenContent | null> {
  const order = topicOrder(types, base.uid, base.day, excluded);
  for (const list of lists) {
    for (const topic of order) {
      try {
        const content = await COMPOSERS[topic]({ ...base, list });
        if (content) return { content, list };
      } catch (error) {
        logger.warn('assunto da notificação diária falhou', { topic, listId: list.listId, error });
      }
    }
  }
  return null;
}

export { chooseDailyContent, topicOrder };
