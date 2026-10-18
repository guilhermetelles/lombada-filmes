/**
 * Decide quem venceu o mês: os membros com mais pontos (empate: todos os empatados). Lista com 1
 * membro, ou mês em que ninguém pontuou, não tem vencedor. Pontos de quem saiu da lista não contam.
 *
 * @param memberUids - Membros atuais da lista.
 * @param points - Pontos do mês, por uid.
 * @returns Os uids vencedores, na ordem dos membros; vazio sem vencedor.
 */
function quizScoresWinners(memberUids: readonly string[], points: Readonly<Record<string, number>>): string[] {
  if (memberUids.length < 2) return [];
  const best = Math.max(...memberUids.map((uid) => points[uid] ?? 0));
  if (best <= 0) return [];
  return memberUids.filter((uid) => (points[uid] ?? 0) === best);
}

export { quizScoresWinners };
