package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.Movie
import java.text.Collator
import java.util.Locale
import kotlin.math.roundToInt

/**
 * Um traço do gosto da lista (um gênero, uma década ou um diretor).
 *
 * @property label Nome para a tela ("Comédia", "Anos 90", "Joel Coen").
 * @property count Quantos filmes da lista têm o traço.
 * @property bestPosition Melhor posição no ranking entre esses filmes.
 * @property weight Soma da nota de vocês (10 para o 1º, 1 para o último) desses filmes: junta
 *   quantidade e colocação, e é o que ordena os traços.
 * @property personId Id do diretor no TMDb, só nos diretores.
 */
data class TasteTrait(
    val label: String,
    val count: Int,
    val bestPosition: Int,
    val weight: Double,
    val personId: Int? = null
)

/**
 * Perfil de gosto da lista, calculado no app a partir das entradas e de `movies/`.
 *
 * @property films Filmes na lista.
 * @property genres Até 5 gêneros, do que mais pesa para o que menos pesa.
 * @property decades Até 3 décadas de lançamento.
 * @property directors Até 3 diretores com pelo menos 2 filmes na lista.
 * @property averageMinutes Duração média dos filmes com duração conhecida.
 */
data class TasteProfile(
    val films: Int,
    val genres: List<TasteTrait>,
    val decades: List<TasteTrait>,
    val directors: List<TasteTrait>,
    val averageMinutes: Int?
) {
    /** Se não há nada para mostrar. */
    val isEmpty: Boolean get() = genres.isEmpty() && decades.isEmpty() && directors.isEmpty()
}

/** Cálculo do perfil de gosto da aba Sugestões. */
object TasteProfiles {
    /** Gêneros mostrados. */
    const val TOP_GENRES = 5

    /** Décadas mostradas. */
    const val TOP_DECADES = 3

    /** Diretores mostrados. */
    const val TOP_DIRECTORS = 3

    /** Filmes que um diretor precisa ter na lista para entrar no perfil. */
    const val MIN_DIRECTOR_FILMS = 2

    private val byName = Collator.getInstance(Locale.forLanguageTag("pt-BR"))

    /**
     * Calcula o perfil. Cada filme vale a nota de vocês pela posição ([CoupleScore]), então um
     * traço sobe tanto por aparecer mais quanto por estar mais no topo; empate pela melhor posição
     * e depois pelo nome.
     *
     * @param ranking Entradas na ordem do ranking.
     * @param movies Filmes de `movies/`, para gêneros e duração; filme que ainda não chegou só
     *   conta na década e nos diretores, que vêm da própria entrada.
     * @return O perfil.
     */
    fun of(ranking: List<Entry>, movies: Map<Int, Movie>): TasteProfile {
        val total = ranking.size
        val genres = mutableListOf<Hit>()
        val decades = mutableListOf<Hit>()
        val directors = mutableListOf<Hit>()
        ranking.forEachIndexed { index, entry ->
            val position = index + 1
            val score = CoupleScore.of(position, total)
            movies[entry.tmdbId]?.genres.orEmpty().distinct().forEach { genres += Hit(it, position, score) }
            entry.movie.year?.let { decades += Hit(decadeLabel(it), position, score) }
            entry.movie.directors.distinctBy { it.id }.forEach {
                directors += Hit(it.id.toString(), position, score, it.name)
            }
        }
        val minutes = ranking.mapNotNull { movies[it.tmdbId]?.runtime?.takeIf { minutes -> minutes > 0 } }
        return TasteProfile(
            films = total,
            genres = rank(genres).take(TOP_GENRES),
            decades = rank(decades).take(TOP_DECADES),
            directors = rank(directors).filter { it.count >= MIN_DIRECTOR_FILMS }.take(TOP_DIRECTORS),
            averageMinutes = if (minutes.isEmpty()) null else minutes.average().roundToInt()
        )
    }

    /**
     * Nome da década, como nos relatórios.
     *
     * @param year Ano de lançamento.
     * @return "Anos 90" ou "Anos 2000".
     */
    fun decadeLabel(year: Int): String {
        val decade = year / 10 * 10
        return if (decade >= 2000) "Anos $decade" else "Anos ${decade.toString().takeLast(2)}"
    }

    private fun rank(hits: List<Hit>): List<TasteTrait> = hits
        .groupBy { it.key }
        .map { (key, group) ->
            val name = group.first().name
            TasteTrait(
                label = name ?: key,
                count = group.size,
                bestPosition = group.minOf { it.position },
                weight = group.sumOf { it.score },
                personId = if (name != null) key.toIntOrNull() else null
            )
        }.sortedWith(
            compareByDescending<TasteTrait> { it.weight }
                .thenBy { it.bestPosition }
                .thenBy(byName) { it.label }
        )

    /** Um filme com um traço: chave, posição e nota pela posição. */
    private data class Hit(val key: String, val position: Int, val score: Double, val name: String? = null)
}
