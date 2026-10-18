package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Entry

/** Como a página única de filme se apresenta, conforme o filme está ou não na lista. */
sealed interface MoviePage {
    /** A lista ainda não chegou: nem posição nem compatibilidade, e sem rodapé. */
    data object Unknown : MoviePage

    /**
     * Filme da lista: posição, nota de vocês, "O que vocês acharam" e "Editar registro".
     *
     * @property entry Entrada do filme.
     * @property position Posição no ranking, a partir de 1.
     */
    data class InList(val entry: Entry, val position: Int) : MoviePage

    /** Filme de fora: compatibilidade e o rodapé "Adicionar" e "Quero ver". */
    data object Outside : MoviePage

    companion object {
        /**
         * Decide o modo da página.
         *
         * @param tmdbId Filme aberto.
         * @param ranking Entradas na ordem do ranking.
         * @param listLoaded Se as entradas já chegaram.
         * @return O modo; o filme passa a [InList] assim que a entrada nova aparece no ranking.
         */
        fun of(tmdbId: Int, ranking: List<Entry>, listLoaded: Boolean): MoviePage {
            val index = ranking.indexOfFirst { it.tmdbId == tmdbId }
            return when {
                index >= 0 -> InList(ranking[index], index + 1)
                listLoaded -> Outside
                else -> Unknown
            }
        }
    }
}
