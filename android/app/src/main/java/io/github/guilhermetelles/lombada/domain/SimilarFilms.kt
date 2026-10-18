package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Entry

/**
 * O que se sabe de um filme fora da lista, de `movies/` ou das sugestões.
 *
 * @property tmdbId Filme.
 * @property title Título.
 * @property year Ano.
 * @property posterPath Capa.
 * @property score Compatibilidade de 0 a 100, quando as sugestões calcularam.
 */
data class FilmInfo(val tmdbId: Int, val title: String, val year: Int?, val posterPath: String?, val score: Int? = null)

/**
 * Um card de "Filmes parecidos".
 *
 * @property tmdbId Filme.
 * @property title Título.
 * @property year Ano.
 * @property posterPath Capa.
 * @property position Posição na lista; null para filme de fora.
 * @property score Compatibilidade, para filme de fora, quando houver.
 */
data class SimilarFilm(
    val tmdbId: Int,
    val title: String,
    val year: Int?,
    val posterPath: String?,
    val position: Int?,
    val score: Int?
)

/** Monta a fileira "Filmes parecidos" a partir das recomendações do TMDb (`movies/{tmdbId}.recs`). */
object SimilarFilms {
    /**
     * Primeiro os que já estão na lista, pela posição; depois os de fora, pela compatibilidade (os
     * sem compatibilidade no fim, na ordem do TMDb). Filme de fora sem título conhecido fica de fora.
     *
     * @param currentTmdbId Filme aberto, que nunca aparece na própria fileira.
     * @param recs Ids recomendados, na ordem do TMDb.
     * @param ranking Entradas na ordem do ranking.
     * @param known O que se sabe dos filmes de fora, por id.
     * @return Os cards.
     */
    fun of(currentTmdbId: Int, recs: List<Int>, ranking: List<Entry>, known: Map<Int, FilmInfo>): List<SimilarFilm> {
        val positions = ranking.withIndex().associate { (index, entry) -> entry.tmdbId to (index + 1 to entry) }
        val ids = recs.distinct().filter { it != currentTmdbId }
        val inList =
            ids.mapNotNull { id ->
                val (position, entry) = positions[id] ?: return@mapNotNull null
                SimilarFilm(id, entry.movie.title, entry.movie.year, entry.movie.posterPath, position, null)
            }.sortedBy { it.position }
        val outside =
            ids.filter { it !in positions }.mapNotNull { id ->
                val info = known[id] ?: return@mapNotNull null
                SimilarFilm(id, info.title, info.year, info.posterPath, null, info.score)
            }.sortedByDescending { it.score ?: -1 }
        return inList + outside
    }
}
