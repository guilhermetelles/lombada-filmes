package io.github.guilhermetelles.lombada.domain

import kotlin.random.Random

/**
 * Um filme que pode sair no sorteio, com o que os filtros precisam.
 *
 * @property tmdbId Filme.
 * @property title Título.
 * @property year Ano.
 * @property posterPath Capa.
 * @property runtime Duração em minutos.
 * @property genres Gêneros em português.
 * @property vote Nota média no TMDb, de 0 a 10.
 * @property votes Votos no TMDb.
 * @property providers Streaming por assinatura no Brasil.
 * @property score Compatibilidade, de 0 a 100, quando as sugestões calcularam.
 * @property reason Por que combina, quando as sugestões calcularam.
 * @property addedBy Quem pôs na fila; null para sugestão.
 */
data class RouletteFilm(
    val tmdbId: Int,
    val title: String,
    val year: Int?,
    val posterPath: String?,
    val runtime: Int?,
    val genres: List<String>,
    val vote: Double?,
    val votes: Int?,
    val providers: List<String>,
    val score: Int?,
    val reason: String?,
    val addedBy: String?
)

/**
 * Filtros rápidos do sorteio, aplicados sobre os dados do filme.
 *
 * @property label Rótulo do chip.
 */
enum class RouletteFilter(val label: String) {
    /** Até 1h40. */
    Short("Até 1h40"),

    /** Gênero Comédia. */
    Comedy("Comédia"),

    /** Nota do TMDb abaixo de 6 com pelo menos 30 votos. */
    BadOnPurpose("Ruim de propósito"),

    /** Em algum streaming por assinatura no Brasil. */
    Streaming("Só streaming");

    /**
     * Diz se o filme passa no filtro. Sem o dado, não passa.
     *
     * @param film Filme.
     * @return Se passa.
     */
    fun test(film: RouletteFilm): Boolean = when (this) {
        Short -> film.runtime != null && film.runtime in 1..Roulette.SHORT_MINUTES

        Comedy -> "Comédia" in film.genres

        BadOnPurpose -> film.vote != null && (film.votes ?: 0) >= Roulette.BAD_MIN_VOTES &&
            film.vote < Roulette.BAD_VOTE

        Streaming -> film.providers.isNotEmpty()
    }
}

/** De onde saem os candidatos do sorteio. */
enum class RouletteSource {
    /** Da fila "Quero ver". */
    Queue,

    /** Das sugestões, porque a fila está vazia ou nada nela passa nos filtros. */
    Suggestions
}

/**
 * Candidatos de um sorteio.
 *
 * @property source De onde vieram.
 * @property films Os que passam nos filtros.
 */
data class RoulettePool(val source: RouletteSource, val films: List<RouletteFilm>)

/** Regras do sorteio "O que vamos ver hoje?" (`rlCandidates` do mock). */
object Roulette {
    /** Limite do filtro "Até 1h40", em minutos. */
    const val SHORT_MINUTES = 100

    /** Nota do TMDb abaixo da qual o filme é "ruim de propósito". */
    const val BAD_VOTE = 6.0

    /** Votos mínimos no TMDb para a nota valer no "ruim de propósito". */
    const val BAD_MIN_VOTES = 30

    /**
     * Escolhe os candidatos: a fila, se algo nela passa nos filtros; senão, as sugestões que não
     * estão na fila.
     *
     * @param queue Filmes da fila (já sem os que estão na lista).
     * @param suggestions Sugestões, da mais compatível para a menos (já sem os da lista).
     * @param filters Filtros ligados; todos precisam passar.
     * @return Os candidatos e de onde vieram.
     */
    fun candidates(
        queue: List<RouletteFilm>,
        suggestions: List<RouletteFilm>,
        filters: Set<RouletteFilter>
    ): RoulettePool {
        val passes = { film: RouletteFilm -> filters.all { it.test(film) } }
        val fromQueue = queue.filter(passes)
        if (fromQueue.isNotEmpty()) return RoulettePool(RouletteSource.Queue, fromQueue)
        val queued = queue.map { it.tmdbId }.toSet()
        val fromSuggestions = suggestions.distinctBy { it.tmdbId }.filter { it.tmdbId !in queued && passes(it) }
        return RoulettePool(RouletteSource.Suggestions, fromSuggestions)
    }

    /**
     * Sorteia um filme, evitando repetir o anterior quando há outro.
     *
     * @param films Candidatos.
     * @param previous Filme sorteado antes.
     * @param random Gerador.
     * @return O sorteado, ou null sem candidatos.
     */
    fun pick(films: List<RouletteFilm>, previous: Int?, random: Random = Random.Default): RouletteFilm? {
        if (films.isEmpty()) return null
        val index = random.nextInt(films.size)
        val chosen = films[index]
        return if (films.size > 1 && chosen.tmdbId == previous) films[(index + 1) % films.size] else chosen
    }

    /**
     * Frase de onde vêm os candidatos.
     *
     * @param pool Candidatos.
     * @param queueSize Filmes na fila, sem filtro.
     * @return O texto para a tela.
     */
    fun sourceText(pool: RoulettePool, queueSize: Int): String {
        val count = Formatting.count(pool.films.size, "filme", "filmes")
        return when {
            pool.films.isEmpty() -> "Nada com esses filtros, nem na fila nem nas sugestões."
            pool.source == RouletteSource.Queue -> "Sorteando entre $count da fila de vocês."
            queueSize > 0 -> "A fila não tem nada com esses filtros: sorteando entre $count das sugestões."
            else -> "A fila está vazia: sorteando entre $count das sugestões."
        }
    }
}
