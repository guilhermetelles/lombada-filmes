package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.MovieSnapshot
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DuelPairTest {
    private fun ranking(n: Int): List<Entry> {
        val keys = FractionalIndex.keysBetween(null, null, n)
        return (0 until n).map { i ->
            Entry("e$i", i + 1, keys[i], null, "", "u", MovieSnapshot("e$i", null, null, null, null, emptyList()))
        }
    }

    // Aplica as chaves novas e ordena como o Firestore.
    private fun apply(ranking: List<Entry>, keys: Map<String, String>): List<String> = ranking
        .map { entry -> keys[entry.id]?.let { entry.copy(rankKey = it) } ?: entry }
        .sortedBy { it.rankKey }
        .map { it.id }

    @Test
    fun `par do dia são vizinhos e fixos no dia`() {
        val list = ranking(10)
        val day = LocalDate.of(2026, 10, 18)
        val (a, b) = DuelPair.ofDay(list, day)!!
        assertEquals(list.indexOf(a) + 1, list.indexOf(b))
        assertEquals(a to b, DuelPair.ofDay(list, day))
    }

    @Test
    fun `sem par com menos de dois filmes`() {
        assertNull(DuelPair.ofDay(ranking(1), LocalDate.of(2026, 10, 18)))
        val pair = DuelPair.ofDay(ranking(2), LocalDate.of(2026, 10, 18))
        assertEquals("e0", pair?.first?.id)
        assertEquals("e1", pair?.second?.id)
    }

    @Test
    fun `par pelos ids sai na ordem do ranking`() {
        val list = ranking(5)
        assertEquals("e1" to "e3", DuelPair.ofIds(list, "e3", "e1")?.let { it.first.id to it.second.id })
        assertNull(DuelPair.ofIds(list, "e1", "x"))
        assertNull(DuelPair.ofIds(list, "e1", "e1"))
    }

    @Test
    fun `trocar vizinhas muda só a de cima`() {
        val list = ranking(5)
        val keys = DuelPair.swapKeys(list, "e1", "e2")!!
        assertEquals(setOf("e1"), keys.keys)
        assertEquals(listOf("e0", "e2", "e1", "e3", "e4"), apply(list, keys))
    }

    @Test
    fun `trocar vizinhas no fim da lista`() {
        val list = ranking(3)
        assertEquals(listOf("e0", "e2", "e1"), apply(list, DuelPair.swapKeys(list, "e2", "e1")!!))
    }

    @Test
    fun `trocar entradas distantes, inclusive nas pontas`() {
        val list = ranking(6)
        assertEquals(listOf("e0", "e4", "e2", "e3", "e1", "e5"), apply(list, DuelPair.swapKeys(list, "e1", "e4")!!))
        assertEquals(listOf("e5", "e1", "e2", "e3", "e4", "e0"), apply(list, DuelPair.swapKeys(list, "e0", "e5")!!))
    }
}
