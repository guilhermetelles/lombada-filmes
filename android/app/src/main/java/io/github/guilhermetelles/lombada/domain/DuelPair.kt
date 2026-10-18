package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Entry
import java.time.LocalDate

/**
 * Duelo de revisão: o par de vizinhos do dia e as chaves novas para trocar duas entradas de lugar.
 */
object DuelPair {
    /**
     * Par de vizinhos no ranking, fixo para o dia (o mesmo dia escolhe sempre o mesmo par).
     *
     * @param ranking Entradas na ordem do ranking.
     * @param day Dia em Brasília.
     * @return A de cima e a de baixo, ou null com menos de dois filmes.
     */
    fun ofDay(ranking: List<Entry>, day: LocalDate): Pair<Entry, Entry>? {
        if (ranking.size < 2) return null
        val index = Math.floorMod("$day:duel".hashCode(), ranking.size - 1)
        return ranking[index] to ranking[index + 1]
    }

    /**
     * Ordena um par pela posição no ranking.
     *
     * @param ranking Entradas na ordem do ranking.
     * @param idA Uma entrada.
     * @param idB Outra entrada.
     * @return A mais bem colocada primeiro, ou null se alguma não está na lista (ou são a mesma).
     */
    fun ofIds(ranking: List<Entry>, idA: String, idB: String): Pair<Entry, Entry>? {
        if (idA == idB) return null
        val a = ranking.indexOfFirst { it.id == idA }
        val b = ranking.indexOfFirst { it.id == idB }
        if (a < 0 || b < 0) return null
        return if (a < b) ranking[a] to ranking[b] else ranking[b] to ranking[a]
    }

    /**
     * Chaves de ordem que trocam duas entradas de lugar. Vizinhas: só a de cima muda, para logo
     * abaixo da outra. Distantes: cada uma ganha uma chave entre os vizinhos do lugar da outra.
     *
     * @param ranking Entradas na ordem do ranking.
     * @param idA Uma entrada.
     * @param idB Outra entrada.
     * @return Chave nova por id de entrada, ou null se alguma não está na lista.
     */
    fun swapKeys(ranking: List<Entry>, idA: String, idB: String): Map<String, String>? {
        val (top, bottom) = ofIds(ranking, idA, idB) ?: return null
        val i = ranking.indexOf(top)
        val j = ranking.indexOf(bottom)
        if (j == i + 1) {
            return mapOf(top.id to FractionalIndex.keyBetween(bottom.rankKey, ranking.getOrNull(j + 1)?.rankKey))
        }
        // Os vizinhos de cada lugar não são nenhuma das duas, então as chaves antigas deles servem.
        return mapOf(
            top.id to FractionalIndex.keyBetween(ranking[j - 1].rankKey, ranking.getOrNull(j + 1)?.rankKey),
            bottom.id to FractionalIndex.keyBetween(ranking.getOrNull(i - 1)?.rankKey, ranking[i + 1].rankKey)
        )
    }
}
