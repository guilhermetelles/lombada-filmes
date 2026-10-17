package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Entry
import kotlin.math.abs

/** Fonte de nota comparada com a de vocês. */
enum class RatingSource(val label: String) {
    /** IMDb, de 0 a 10. */
    Imdb("IMDb"),

    /** Letterboxd, de 0 a 5. */
    Letterboxd("Letterboxd")
}

/**
 * Como um filme fica contra uma fonte.
 *
 * @property source Fonte.
 * @property rating Nota da fonte, ou null.
 * @property difference Nota de vocês menos a da fonte (contra o Letterboxd, em escala /5), ou null.
 * @property position Posição que o filme teria ordenando a lista pela nota da fonte.
 * @property why Explicação curta da diferença de posição.
 * @property youRankHigher Se vocês colocaram o filme acima da fonte.
 */
data class SourceStanding(
    val source: RatingSource,
    val rating: Double?,
    val difference: Double?,
    val position: Int,
    val why: String,
    val youRankHigher: Boolean
)

/**
 * A nota de vocês e a comparação com IMDb e Letterboxd, como no detalhe do mock.
 *
 * @property position Posição no ranking.
 * @property total Quantidade de filmes.
 * @property score Nota de vocês, de 1 a 10.
 * @property sources IMDb e Letterboxd.
 */
data class Standing(val position: Int, val total: Int, val score: Double, val sources: List<SourceStanding>) {
    companion object {
        /**
         * Calcula a posição do filme na lista e onde ficaria por cada fonte.
         *
         * @param ranking Entradas na ordem do ranking.
         * @param entryId Entrada do filme.
         * @return A comparação, ou null se a entrada não está na lista.
         */
        fun of(ranking: List<Entry>, entryId: String): Standing? {
            val index = ranking.indexOfFirst { it.id == entryId }
            if (index < 0) return null
            val entry = ranking[index]
            val position = index + 1
            val score = CoupleScore.of(position, ranking.size)
            val sources =
                RatingSource.entries.map { source ->
                    val rating = ratingOf(entry, source)
                    val sourcePosition = orderBy(ranking, source).indexOfFirst { it.id == entryId } + 1
                    val mine = if (source == RatingSource.Letterboxd) score / 2 else score
                    SourceStanding(
                        source = source,
                        rating = rating,
                        difference = rating?.let { mine - it },
                        position = sourcePosition,
                        why = why(position, sourcePosition, source.label),
                        youRankHigher = sourcePosition > position
                    )
                }
            return Standing(position, ranking.size, score, sources)
        }

        /**
         * Ordena a lista pela nota de uma fonte, da maior para a menor; sem nota vai para o fim e o
         * ranking desempata.
         *
         * @param ranking Entradas na ordem do ranking.
         * @param source Fonte.
         * @return Entradas na ordem da fonte.
         */
        fun orderBy(ranking: List<Entry>, source: RatingSource): List<Entry> {
            val rank = ranking.withIndex().associate { (index, entry) -> entry.id to index }
            return ranking.sortedWith(
                compareByDescending<Entry> {
                    ratingOf(it, source) ?: -1.0
                }.thenBy { rank.getValue(it.id) }
            )
        }

        /**
         * Diferença com sinal e uma casa, como no mock: `+1.2`, `−0.4` ou `0`.
         *
         * @param difference Diferença.
         * @return Texto formatado.
         */
        fun signed(difference: Double): String = when {
            abs(difference) < 0.05 -> "0"
            difference > 0 -> "+${Formatting.oneDecimal(difference)}"
            else -> "−${Formatting.oneDecimal(-difference)}"
        }

        private fun ratingOf(entry: Entry, source: RatingSource): Double? = when (source) {
            RatingSource.Imdb -> entry.movie.imdb
            RatingSource.Letterboxd -> entry.movie.letterboxd
        }

        private fun why(mine: Int, theirs: Int, label: String): String {
            val gap = abs(theirs - mine)
            val positions = if (gap == 1) "posição" else "posições"
            return when {
                theirs > mine -> "Vocês colocaram $gap $positions acima do $label"
                theirs < mine -> "O $label coloca $gap $positions acima"
                else -> "Mesma posição que no $label"
            }
        }
    }
}
