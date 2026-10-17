package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Entry

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
}
