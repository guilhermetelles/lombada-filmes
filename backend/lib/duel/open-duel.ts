import { NotFoundError } from '../errors/app-errors.js';
import { type RankedEntry, readRankedEntries } from '../events/list-entries.js';
import { createIfAbsent } from '../firestore/idempotent.js';
import { requireMember } from '../lists/list-access.js';
import { listDocument } from '../lists/list-repository.js';
import { brazilDay } from '../time/brazil-day.js';
import type { Dependencies } from '../types/dependencies.js';
import type { Duel, DuelView } from '../types/duel.js';
import { duelDocument, toDuelView } from './duel-repository.js';
import { pickDuelPair } from './pick-duel-pair.js';

/** Quem abre o duelo, em qual lista e, se veio da notificação, o par que ela mostrou. */
type OpenRequest = { uid: string; listId: string; entryIdA?: string | undefined; entryIdB?: string | undefined };

/**
 * Devolve o duelo de hoje, criando duels/{dia} na primeira vez que alguém da lista abre a tela. O par
 * é o da notificação, se as duas entradas ainda estiverem na lista, ou o sorteio do dia. Depois de
 * criado, o par não muda no dia, mesmo que a lista mude.
 *
 * @param dependencies - Banco e relógio.
 * @param request - Quem abre, a lista e o par da notificação.
 * @returns O duelo de hoje.
 * @throws {NotFoundError} Se a lista não existir, ou se tiver menos de dois filmes.
 * @throws {ForbiddenError} Se a pessoa não for integrante.
 */
async function openDuel({ db, now }: Dependencies, request: OpenRequest): Promise<DuelView> {
  const { uid, listId } = request;
  const day = brazilDay(now());
  requireMember((await listDocument(db, listId).get()).data(), uid);
  const ref = duelDocument(db, listId, day);
  const existing = (await ref.get()).data();
  if (existing) return toDuelView(existing);

  const entries = await readRankedEntries(db, listId);
  const pair = pairFromRoute(entries, request) ?? pickDuelPair(entries, day, listId);
  if (!pair) throw new NotFoundError('o duelo precisa de pelo menos dois filmes na lista');

  const duel: Duel = {
    day,
    entryIdA: pair[0].entryId,
    entryIdB: pair[1].entryId,
    votes: {},
    status: 'open',
    createdAt: now(),
  };
  if (await createIfAbsent(ref, duel)) return toDuelView(duel);
  // Outra pessoa abriu ao mesmo tempo: vale o par que ela gravou.
  const created = (await ref.get()).data();
  return toDuelView(created ?? duel);
}

/**
 * O par que veio na rota da notificação, na ordem do ranking de agora.
 *
 * @param entries - Entradas na ordem do ranking.
 * @param request - Ids pedidos.
 * @returns A de cima e a de baixo, ou null se faltar algum id, se forem iguais ou se alguma saiu da lista.
 */
function pairFromRoute(
  entries: readonly RankedEntry[],
  { entryIdA, entryIdB }: OpenRequest,
): [RankedEntry, RankedEntry] | null {
  if (!entryIdA || !entryIdB || entryIdA === entryIdB) return null;
  const a = entries.find((entry) => entry.entryId === entryIdA);
  const b = entries.find((entry) => entry.entryId === entryIdB);
  if (!a || !b) return null;
  return a.position < b.position ? [a, b] : [b, a];
}

export { openDuel };
