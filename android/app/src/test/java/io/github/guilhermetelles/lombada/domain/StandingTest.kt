package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.MovieSnapshot
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class StandingTest {
    private fun entry(id: String, imdb: Double?, letterboxd: Double?) =
        Entry(id, id.hashCode(), "a$id", null, "", "u", MovieSnapshot(id, null, null, imdb, letterboxd, emptyList()))

    // Ranking de vocês: a, b, c. IMDb ordena c, a, b; Letterboxd ordena a, b, c (c sem nota).
    private val ranking = listOf(entry("a", 7.5, 3.7), entry("b", 6.0, 3.0), entry("c", 8.8, null))

    @Test
    fun `compara com a posição por nota de cada fonte`() {
        val standing = requireNotNull(Standing.of(ranking, "a"))
        assertEquals(10.0, standing.score, 1e-9)
        val (imdb, letterboxd) = standing.sources
        assertEquals(2, imdb.position)
        assertEquals("Vocês colocaram 1 posição acima do IMDb", imdb.why)
        assertEquals("+2.5", Standing.signed(requireNotNull(imdb.difference)))
        assertEquals(1, letterboxd.position)
        assertEquals("Mesma posição que no Letterboxd", letterboxd.why)
        assertEquals("+1.3", Standing.signed(requireNotNull(letterboxd.difference)))
    }

    @Test
    fun `sem nota vai para o fim e não tem diferença`() {
        val letterboxd = requireNotNull(Standing.of(ranking, "c")).sources[1]
        assertEquals(3, letterboxd.position)
        assertNull(letterboxd.difference)
        val imdb = requireNotNull(Standing.of(ranking, "c")).sources[0]
        assertEquals("O IMDb coloca 2 posições acima", imdb.why)
    }

    @Test
    fun `sinal da diferença`() {
        assertEquals("0", Standing.signed(0.02))
        assertEquals("−0.4", Standing.signed(-0.4))
    }
}
