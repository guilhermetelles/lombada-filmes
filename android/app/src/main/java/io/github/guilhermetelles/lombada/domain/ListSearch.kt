package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.CastMember
import io.github.guilhermetelles.lombada.data.model.Entry
import java.text.Normalizer

/**
 * Um filme da lista que bate com a busca.
 *
 * @property entry Entrada.
 * @property reason Por que bateu, quando não foi pelo título: "Direção de …" ou "Com …".
 */
data class ListMatch(val entry: Entry, val reason: String?)

/** Grupo "Na lista de vocês" da busca, calculado no app: título, diretor ou ator. */
object ListSearch {
    private val marks = Regex("\\p{Mn}+")

    /**
     * Tira acentos e caixa, para "amelie" achar "Amélie".
     *
     * @param text Texto.
     * @return Texto normalizado.
     */
    fun normalize(text: String): String = marks.replace(Normalizer.normalize(text, Normalizer.Form.NFD), "").lowercase()

    /**
     * Filtra a lista pelo termo.
     *
     * @param query Termo digitado.
     * @param ranking Entradas na ordem do ranking.
     * @param castByMovie Elenco de cada filme, de `movies/{tmdbId}.cast`.
     * @return Entradas que batem, na ordem do ranking.
     */
    fun match(query: String, ranking: List<Entry>, castByMovie: Map<Int, List<CastMember>>): List<ListMatch> {
        val term = normalize(query.trim())
        if (term.isEmpty()) return emptyList()
        return ranking.mapNotNull { entry ->
            val movie = entry.movie
            when {
                // Pelos dois títulos: o mostrado e o em inglês, quando a tela está em português.
                normalize("${movie.title} ${movie.titleAlt.orEmpty()} ${movie.year ?: ""}").contains(term) ->
                    ListMatch(entry, null)

                else -> {
                    val director = movie.directors.firstOrNull { normalize(it.name).contains(term) }
                    val actor = castByMovie[entry.tmdbId].orEmpty().firstOrNull { normalize(it.name).contains(term) }
                    when {
                        director != null -> ListMatch(entry, "Direção de ${director.name}")
                        actor != null -> ListMatch(entry, "Com ${actor.name}")
                        else -> null
                    }
                }
            }
        }
    }
}
