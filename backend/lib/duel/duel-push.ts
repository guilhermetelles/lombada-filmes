import { readEntriesWithPositions } from '../events/list-entries.js';
import { createIfAbsent } from '../firestore/idempotent.js';
import { logger } from '../logging/logger.js';
import { notifyLogDocument } from '../notify/notify-repository.js';
import { readNotifyPrefs } from '../notify/prefs.js';
import { sendFcm } from '../notify/send-fcm.js';
import type { Dependencies } from '../types/dependencies.js';
import type { Duel, DuelChoice } from '../types/duel.js';
import type { RouteRef } from '../types/feed.js';
import type { List } from '../types/list.js';

/** Um voto já gravado: quem votou, em qual lista, o duelo depois do voto e a escolha. */
export type DuelVote = { uid: string; listId: string; duel: Duel; choice: DuelChoice };

/** Título e texto de um aviso. */
type PushText = { title: string; body: string };

/**
 * Avisa os outros membros sobre um voto no duelo, para quem tem o duelo ligado nas preferências.
 * Voto `swap` com o duelo ainda aberto: avisa quem não votou, no máximo uma vez por pessoa por dia
 * (notifyLog/{uid}_{dia}-duelvote). Duelo fechado: avisa todos menos quem deu o último voto, que já vê
 * o resultado na tela. Os avisos usam a tag duel-{listId}, então o resultado substitui o aviso do
 * voto. Nenhuma falha sai daqui: vai para o log, e o voto continua valendo.
 *
 * @param dependencies - Banco, FCM e relógio.
 * @param list - Documento da lista (membros e nomes).
 * @param vote - O voto e o duelo depois dele.
 * @returns Quantos membros foram avisados agora.
 */
async function pushDuelVote(dependencies: Dependencies, list: List, vote: DuelVote): Promise<number> {
  const { db, now } = dependencies;
  const { uid, listId, duel, choice } = vote;
  const open = duel.status === 'open';
  if (open && choice !== 'swap') return 0;

  let text: PushText;
  try {
    text = await describeVote(dependencies, list, vote);
  } catch (error) {
    logger.warn('aviso do duelo não montado', { listId, day: duel.day, error });
    return 0;
  }
  const recipients = list.memberUids.filter((member) => member !== uid && !(open && duel.votes[member]));
  const route: RouteRef = { name: 'duel', args: { entryId: duel.entryIdA, entryIdB: duel.entryIdB } };

  let pushed = 0;
  for (const member of recipients) {
    try {
      if (!(await readNotifyPrefs(db, member)).types.duel) continue;
      if (open) {
        const claimed = await createIfAbsent(notifyLogDocument(db, member, `${duel.day}-duelvote`), {
          type: 'daily.duel',
          listId,
          sentAt: now(),
        });
        if (!claimed) continue;
      }
      await sendFcm(dependencies, member, { ...text, listId, route, channelId: 'lista', tag: `duel-${listId}` });
      pushed++;
    } catch (error) {
      logger.warn('aviso do duelo não saiu', { listId, member, day: duel.day, error });
    }
  }
  return pushed;
}

/**
 * Monta o título e o texto do aviso com os títulos dos dois filmes e, na troca, a posição nova de B.
 *
 * @param dependencies - Banco.
 * @param list - Documento da lista (nomes).
 * @param vote - O voto e o duelo depois dele.
 * @returns Título e texto.
 * @throws O erro do Firestore, se a leitura das entradas falhar.
 */
async function describeVote({ db }: Dependencies, list: List, { uid, listId, duel }: DuelVote): Promise<PushText> {
  const { entries } = await readEntriesWithPositions(db, listId, [duel.entryIdA, duel.entryIdB]);
  const a = entries.find((entry) => entry.entryId === duel.entryIdA);
  const b = entries.find((entry) => entry.entryId === duel.entryIdB);
  const titleA = a?.movie.title ?? 'o primeiro filme';
  const titleB = b?.movie.title ?? 'o segundo filme';
  const name = firstName(list.memberProfiles?.[uid]?.name ?? '') || 'Alguém da lista';

  if (duel.status === 'swapped') {
    return {
      title: b ? `${titleB} passou para #${b.position}` : `${titleB} passou na frente`,
      body: 'Todos votaram para trocar a ordem.',
    };
  }
  if (duel.status === 'kept') {
    return { title: `${name} votou para manter`, body: `${titleA} continua na frente de ${titleB}.` };
  }
  return {
    title: `${name} votou para trocar a ordem`,
    body: `Vocês ainda acham que ${titleA} é melhor que ${titleB}?`,
  };
}

/**
 * Primeiro nome de um nome completo.
 *
 * @param name - Nome como está em memberProfiles.
 * @returns A primeira palavra, ou vazio.
 */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

export { pushDuelVote };
