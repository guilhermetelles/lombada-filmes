package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.MovieSnapshot
import org.junit.Assert.assertEquals
import org.junit.Test

class SimilarFilmsTest {
    private fun entry(tmdbId: Int) = Entry(
        "e$tmdbId",
        tmdbId,
        "a$tmdbId",
        null,
        "",
        "u",
        MovieSnapshot("Filme $tmdbId", 2000, "/p$tmdbId.jpg", null, null, emptyList())
    )

    @Test
    fun `primeiro os da lista pela posição, depois os de fora pela compatibilidade`() {
        val ranking = listOf(entry(10), entry(20), entry(30))
        val known =
            mapOf(
                1 to FilmInfo(1, "Sem nota", 1999, null),
                2 to FilmInfo(2, "Pouco compatível", 2001, "/a.jpg", 40),
                3 to FilmInfo(3, "Muito compatível", 2002, "/b.jpg", 90)
            )
        val films = SimilarFilms.of(
            currentTmdbId = 99,
            recs = listOf(1, 30, 2, 10, 3, 4),
            ranking = ranking,
            known = known
        )
        assertEquals(listOf(10, 30, 3, 2, 1), films.map { it.tmdbId })
        assertEquals(listOf(1, 3, null, null, null), films.map { it.position })
        assertEquals(listOf(null, null, 90, 40, null), films.map { it.score })
    }

    @Test
    fun `o próprio filme e os repetidos não aparecem`() {
        val films = SimilarFilms.of(10, listOf(10, 20, 20), listOf(entry(10), entry(20)), emptyMap())
        assertEquals(listOf(20), films.map { it.tmdbId })
        assertEquals(2, films.single().position)
        assertEquals("Filme 20", films.single().title)
    }

    @Test
    fun `sem recomendações a fileira fica vazia`() {
        assertEquals(emptyList<SimilarFilm>(), SimilarFilms.of(1, emptyList(), emptyList(), emptyMap()))
    }
}
