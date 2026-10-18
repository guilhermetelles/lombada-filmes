package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.MovieSnapshot
import org.junit.Assert.assertEquals
import org.junit.Test

class MoviePageTest {
    private fun entry(tmdbId: Int) = Entry(
        "e$tmdbId",
        tmdbId,
        "a$tmdbId",
        null,
        "",
        "u",
        MovieSnapshot("Filme $tmdbId", 2000, null, null, null, emptyList())
    )

    @Test
    fun `filme fora da lista mostra compatibilidade e o rodapé de adicionar`() {
        assertEquals(MoviePage.Outside, MoviePage.of(603, listOf(entry(1), entry(2)), listLoaded = true))
    }

    @Test
    fun `antes da lista chegar não decide`() {
        assertEquals(MoviePage.Unknown, MoviePage.of(603, emptyList(), listLoaded = false))
    }

    @Test
    fun `filme da lista com a posição`() {
        val ranking = listOf(entry(1), entry(603), entry(2))
        assertEquals(MoviePage.InList(ranking[1], 2), MoviePage.of(603, ranking, listLoaded = true))
    }

    @Test
    fun `adicionado pela página, vira filme da lista no fim`() {
        val before = listOf(entry(1), entry(2))
        assertEquals(MoviePage.Outside, MoviePage.of(603, before, listLoaded = true))
        val after = before + entry(603)
        assertEquals(MoviePage.InList(after.last(), 3), MoviePage.of(603, after, listLoaded = true))
    }
}
