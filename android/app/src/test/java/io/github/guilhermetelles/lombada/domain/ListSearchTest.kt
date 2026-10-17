package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.CastMember
import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.MovieSnapshot
import io.github.guilhermetelles.lombada.data.model.PersonRef
import org.junit.Assert.assertEquals
import org.junit.Test

class ListSearchTest {
    private val abyss =
        Entry(
            "e1",
            2756,
            "a0",
            null,
            "",
            "u",
            MovieSnapshot("The Abyss", 1989, null, 7.5, 3.7, listOf(PersonRef(2710, "James Cameron")))
        )
    private val amelie =
        Entry(
            "e2",
            194,
            "a1",
            null,
            "",
            "u",
            MovieSnapshot("Amélie", 2001, null, 8.3, 4.1, listOf(PersonRef(2419, "Jean-Pierre Jeunet")))
        )
    private val cast = mapOf(2756 to listOf(CastMember(2712, "Michael Biehn", "Lt. Coffey", null)))

    @Test
    fun `acha pelo título sem acento`() {
        assertEquals(
            listOf("e2" to null),
            ListSearch.match("amelie", listOf(abyss, amelie), cast).map {
                it.entry.id to
                    it.reason
            }
        )
    }

    @Test
    fun `acha pelo diretor e pelo ator`() {
        assertEquals(
            "Direção de James Cameron",
            ListSearch.match("cameron", listOf(abyss, amelie), cast).single().reason
        )
        assertEquals("Com Michael Biehn", ListSearch.match("biehn", listOf(abyss, amelie), cast).single().reason)
    }

    @Test
    fun `termo vazio não acha nada`() {
        assertEquals(emptyList<ListMatch>(), ListSearch.match("  ", listOf(abyss), cast))
    }
}
