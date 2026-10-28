/** Duelo de revisão: o par de vizinhos do dia e o voto de cada membro. */

/** Voto de um membro: manter a ordem ou trocar as duas. */
export type DuelChoice = 'keep' | 'swap';

/** Situação do duelo: aberto, mantido (alguém votou manter) ou trocado (todos votaram trocar). */
export type DuelStatus = 'open' | 'kept' | 'swapped';

/** Documento lists/{listId}/duels/{dia}. */
export type Duel = {
  day: string; // AAAA-MM-DD em Brasília
  entryIdA: string; // estava na frente quando o duelo foi aberto
  entryIdB: string;
  votes: Record<string, DuelChoice>; // por uid
  status: DuelStatus;
  createdAt: Date;
  resolvedAt?: Date | undefined;
};

/** O duelo como o app recebe (GET …/duel e POST …/duel/{dia}/vote). */
export type DuelView = Pick<Duel, 'day' | 'entryIdA' | 'entryIdB' | 'status' | 'votes'>;
