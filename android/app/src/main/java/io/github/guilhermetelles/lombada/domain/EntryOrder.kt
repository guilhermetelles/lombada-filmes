package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Entry
import kotlin.random.Random

/** Ordens de exibição da lista. */
object EntryOrder {
    /**
     * "Ordem em que vimos": por data, com as sem data no fim e o ranking desempatando.
     *
     * @param ranking Entradas na ordem do ranking.
     * @param newestFirst Se as mais recentes vêm primeiro.
     * @return Entradas na ordem das datas.
     */
    fun byWatchedDate(ranking: List<Entry>, newestFirst: Boolean): List<Entry> {
        val rank = ranking.withIndex().associate { (index, entry) -> entry.id to index }
        val dated = compareBy<Entry> { it.watchedOn == null }
        val byDate =
            if (newestFirst) {
                dated.thenByDescending { it.watchedOn }
            } else {
                dated.thenBy { it.watchedOn }
            }
        return ranking.sortedWith(byDate.thenBy { rank.getValue(it.id) })
    }

    /**
     * Chave nova para uma entrada que foi para [toIndex], entre as vizinhas da nova posição.
     *
     * @param order Ranking já com a entrada na posição nova.
     * @param toIndex Posição nova, a partir de 0.
     * @return Chave entre a de cima e a de baixo.
     */
    fun rankKeyAt(order: List<Entry>, toIndex: Int): String =
        FractionalIndex.keyBetween(order.getOrNull(toIndex - 1)?.rankKey, order.getOrNull(toIndex + 1)?.rankKey)

    /**
     * Chave para uma entrada nova no fim da lista. A chave seguinte à última ganha dois dígitos
     * sorteados no fim, para duas pessoas que adicionam ao mesmo tempo não gravarem a mesma chave
     * (chaves iguais travam o duelo e o arraste entre as duas).
     *
     * @param lastKey Chave da última entrada, ou null com a lista vazia.
     * @param random Sorteio, trocado nos testes.
     * @return Chave depois de [lastKey], válida para a `fractional-indexing`.
     */
    fun endKey(lastKey: String?, random: Random = Random.Default): String {
        val next = FractionalIndex.keyBetween(lastKey, null)
        // Sem o dígito "0" no fim: a biblioteca recusa chave terminada em zero.
        val suffix = (1..2).map { TIE_BREAK_DIGITS[random.nextInt(TIE_BREAK_DIGITS.length)] }.joinToString("")
        return next + suffix
    }

    private const val TIE_BREAK_DIGITS = "123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
}
