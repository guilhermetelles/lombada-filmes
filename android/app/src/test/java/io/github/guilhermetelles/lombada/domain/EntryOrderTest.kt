package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.MovieSnapshot
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class EntryOrderTest {
    private val keys = FractionalIndex.keysBetween(null, null, 4)

    private fun entry(id: String, index: Int, date: String?) = Entry(
        id,
        index + 1,
        keys[index],
        date?.let(LocalDate::parse),
        "",
        "u",
        MovieSnapshot(id, null, null, null, null, emptyList())
    )

    private val ranking =
        listOf(
            entry("a", 0, "2025-05-01"),
            entry("b", 1, null),
            entry("c", 2, "2025-07-01"),
            entry("d", 3, "2025-05-01")
        )

    @Test
    fun `por data, mais recentes primeiro, sem data no fim e ranking desempatando`() {
        assertEquals(listOf("c", "a", "d", "b"), EntryOrder.byWatchedDate(ranking, newestFirst = true).map { it.id })
    }

    @Test
    fun `por data, mais antigos primeiro`() {
        assertEquals(listOf("a", "d", "c", "b"), EntryOrder.byWatchedDate(ranking, newestFirst = false).map { it.id })
    }

    @Test
    fun `chave nova fica entre as vizinhas da posição nova`() {
        // "d" foi arrastado para a segunda posição.
        val moved = listOf(ranking[0], ranking[3], ranking[1], ranking[2])
        val key = EntryOrder.rankKeyAt(moved, 1)
        assertTrue(ranking[0].rankKey < key && key < ranking[1].rankKey)
        // "d" foi para o topo.
        val toTop = listOf(ranking[3]) + ranking.take(3)
        assertTrue(EntryOrder.rankKeyAt(toTop, 0) < ranking[0].rankKey)
    }
}
