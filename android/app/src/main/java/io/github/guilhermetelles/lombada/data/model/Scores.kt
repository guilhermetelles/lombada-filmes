package io.github.guilhermetelles.lombada.data.model

/**
 * Placar do quiz num mês, em `lists/{listId}/scores/{mês}`.
 *
 * @property month Mês `AAAA-MM`.
 * @property points Pontos por membro.
 * @property winnerUids Vencedores, gravados quando o mês fecha (os dois, em empate); vazio antes.
 */
data class Scores(val month: String, val points: Map<String, Int>, val winnerUids: List<String>)
