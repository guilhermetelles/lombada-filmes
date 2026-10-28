import { ConflictError, NotFoundError, NotTodayError } from '../errors/app-errors.js';
import { requireMember } from '../lists/list-access.js';
import { listDocument } from '../lists/list-repository.js';
import { brazilDay } from '../time/brazil-day.js';
import type { Dependencies } from '../types/dependencies.js';
import type { Duel, DuelChoice, DuelStatus, DuelView } from '../types/duel.js';
import { pushDuelVote } from './duel-push.js';
import { duelDocument, toDuelView } from './duel-repository.js';
import { duelSwapKeys } from './duel-swap-keys.js';

/** O voto: quem, em qual lista, de qual dia e qual escolha. */
type VoteRequest = { uid: string; listId: string; day: string; choice: DuelChoice };

/**
 * Registra o voto no duelo do dia numa transação. Um voto `keep` fecha o duelo como mantido; quando
 * todos os membros da lista votaram `swap`, as duas entradas trocam de lugar na mesma transação e o
 * duelo fecha como trocado. Depois, avisa os outros membros (falhas no aviso só vão para o log).
 *
 * @param dependencies - Banco, FCM e relógio.
 * @param request - Quem vota, a lista, o dia e a escolha.
 * @returns O duelo depois do voto.
 * @throws {NotTodayError} Se o dia não for hoje em Brasília.
 * @throws {NotFoundError} Se a lista não existir ou se ninguém abriu o duelo do dia.
 * @throws {ForbiddenError} Se a pessoa não for integrante.
 * @throws {ConflictError} Se o duelo já fechou, se um dos filmes saiu da lista ou se as chaves estão empatadas.
 */
async function voteDuel(dependencies: Dependencies, request: VoteRequest): Promise<DuelView> {
  const { db, now } = dependencies;
  const { uid, listId, day, choice } = request;
  if (day !== brazilDay(now())) throw new NotTodayError('só dá para votar no duelo de hoje');

  const ref = duelDocument(db, listId, day);
  const entries = db.collection(`lists/${listId}/entries`);
  const { list, duel } = await db.runTransaction(async (transaction) => {
    const list = requireMember((await transaction.get(listDocument(db, listId))).data(), uid);
    const current = (await transaction.get(ref)).data();
    if (!current) throw new NotFoundError('não há duelo neste dia');
    if (current.status !== 'open') throw new ConflictError('o duelo de hoje já fechou');

    const votes = { ...current.votes, [uid]: choice };
    const status = resolveStatus(votes, list.memberUids);
    // O Firestore exige todas as leituras antes da primeira gravação.
    if (status === 'swapped') {
      const ranking = await transaction.get(entries.orderBy('rankKey'));
      const keys = duelSwapKeys(
        ranking.docs.map((doc) => ({ entryId: doc.id, rankKey: String(doc.get('rankKey')) })),
        current.entryIdA,
        current.entryIdB,
      );
      for (const [entryId, rankKey] of keys) {
        transaction.update(entries.doc(entryId), { rankKey, updatedBy: uid, updatedAt: now() });
      }
    }
    const duel: Duel = { ...current, votes, status, resolvedAt: status === 'open' ? undefined : now() };
    transaction.set(ref, duel);
    return { list, duel };
  });

  await pushDuelVote(dependencies, list, { uid, listId, duel, choice });
  return toDuelView(duel);
}

/**
 * Situação do duelo com os votos de agora.
 *
 * @param votes - Voto de cada membro que já votou.
 * @param memberUids - Membros da lista.
 * @returns `kept` com algum voto `keep`, `swapped` se todos votaram `swap`, senão `open`.
 */
function resolveStatus(votes: Record<string, DuelChoice>, memberUids: readonly string[]): DuelStatus {
  if (Object.values(votes).includes('keep')) return 'kept';
  return memberUids.every((member) => votes[member] === 'swap') ? 'swapped' : 'open';
}

export { voteDuel };
