package io.github.guilhermetelles.lombada.domain

import kotlin.random.Random
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RouletteTest {
    private fun film(
        id: Int,
        runtime: Int? = 120,
        genres: List<String> = emptyList(),
        vote: Double? = null,
        votes: Int? = null,
        providers: List<String> = emptyList()
    ) = RouletteFilm(id, "Filme $id", 2000, null, runtime, genres, vote, votes, providers, null, null, null)

    @Test
    fun `até 1h40 exige duração conhecida de no máximo 100 minutos`() {
        assertTrue(RouletteFilter.Short.test(film(1, runtime = 100)))
        assertFalse(RouletteFilter.Short.test(film(1, runtime = 101)))
        assertFalse(RouletteFilter.Short.test(film(1, runtime = null)))
        assertFalse(RouletteFilter.Short.test(film(1, runtime = 0)))
    }

    @Test
    fun `comédia pelo gênero em português`() {
        assertTrue(RouletteFilter.Comedy.test(film(1, genres = listOf("Terror", "Comédia"))))
        assertFalse(RouletteFilter.Comedy.test(film(1, genres = listOf("Drama"))))
    }

    @Test
    fun `ruim de propósito é nota abaixo de 6 com pelo menos 30 votos`() {
        assertTrue(RouletteFilter.BadOnPurpose.test(film(1, vote = 5.9, votes = 30)))
        assertFalse(RouletteFilter.BadOnPurpose.test(film(1, vote = 5.9, votes = 29)))
        assertFalse(RouletteFilter.BadOnPurpose.test(film(1, vote = 6.0, votes = 500)))
        assertFalse(RouletteFilter.BadOnPurpose.test(film(1, vote = null, votes = 500)))
        assertFalse(RouletteFilter.BadOnPurpose.test(film(1, vote = 3.0, votes = null)))
    }

    @Test
    fun `só streaming exige algum serviço no Brasil`() {
        assertTrue(RouletteFilter.Streaming.test(film(1, providers = listOf("Netflix"))))
        assertFalse(RouletteFilter.Streaming.test(film(1)))
    }

    @Test
    fun `sorteia da fila quando algo nela passa nos filtros`() {
        val queue = listOf(film(1, runtime = 90), film(2, runtime = 150))
        val suggestions = listOf(film(3, runtime = 80))
        val pool = Roulette.candidates(queue, suggestions, setOf(RouletteFilter.Short))
        assertEquals(RouletteSource.Queue, pool.source)
        assertEquals(listOf(1), pool.films.map { it.tmdbId })
    }

    @Test
    fun `cai nas sugestões quando a fila não tem nada com os filtros, sem repetir a fila`() {
        val queue = listOf(film(1, runtime = 150, providers = listOf("Max")))
        val suggestions =
            listOf(
                film(1, runtime = 90, providers = listOf("Max")),
                film(3, runtime = 90, providers = listOf("Netflix")),
                film(4, runtime = 90),
                film(3, runtime = 90, providers = listOf("Netflix"))
            )
        val pool = Roulette.candidates(queue, suggestions, setOf(RouletteFilter.Short, RouletteFilter.Streaming))
        assertEquals(RouletteSource.Suggestions, pool.source)
        assertEquals(listOf(3), pool.films.map { it.tmdbId })
        assertEquals(
            "A fila não tem nada com esses filtros: sorteando entre 1 filme das sugestões.",
            Roulette.sourceText(pool, queueSize = 1)
        )
    }

    @Test
    fun `fila vazia sorteia entre as sugestões`() {
        val pool = Roulette.candidates(emptyList(), listOf(film(3), film(4)), emptySet())
        assertEquals(RouletteSource.Suggestions, pool.source)
        assertEquals("A fila está vazia: sorteando entre 2 filmes das sugestões.", Roulette.sourceText(pool, 0))
    }

    @Test
    fun `nada nos filtros nem na fila nem nas sugestões`() {
        val pool = Roulette.candidates(listOf(film(1)), listOf(film(2)), setOf(RouletteFilter.Comedy))
        assertTrue(pool.films.isEmpty())
        assertEquals("Nada com esses filtros, nem na fila nem nas sugestões.", Roulette.sourceText(pool, 1))
        assertNull(Roulette.pick(pool.films, previous = null))
    }

    @Test
    fun `texto da fila`() {
        val pool = Roulette.candidates(listOf(film(1), film(2)), emptyList(), emptySet())
        assertEquals("Sorteando entre 2 filmes da fila de vocês.", Roulette.sourceText(pool, 2))
    }

    @Test
    fun `não repete o anterior quando há outro`() {
        val films = listOf(film(1), film(2), film(3))
        repeat(50) { seed ->
            val chosen = Roulette.pick(films, previous = 2, random = Random(seed))
            assertTrue(chosen != null && chosen.tmdbId != 2)
        }
        assertEquals(7, Roulette.pick(listOf(film(7)), previous = 7)?.tmdbId)
    }
}
