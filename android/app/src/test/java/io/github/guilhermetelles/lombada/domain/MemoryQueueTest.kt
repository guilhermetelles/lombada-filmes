package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.MovieSnapshot
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MemoryQueueTest {
    private val today = LocalDate.of(2026, 10, 18)

    private fun entry(id: String, date: String?, comment: String = "comentário de $id") = Entry(
        id,
        id.hashCode(),
        "a0",
        date?.let(LocalDate::parse),
        comment,
        "u",
        MovieSnapshot(id, null, null, null, null, emptyList())
    )

    @Test
    fun `só entram comentários com data passada de 30 dias ou mais`() {
        val queue =
            MemoryQueue.queue(
                listOf(
                    entry("novo", "2026-10-01"),
                    entry("trinta", "2026-09-18"),
                    entry("sem-data", null),
                    entry("sem-comentario", "2025-01-01", comment = "  "),
                    entry("futuro", "2026-12-01")
                ),
                today
            )
        assertEquals(listOf("trinta"), queue.map { it.entry.id })
        assertEquals(30L, queue.single().daysAgo)
    }

    @Test
    fun `aniversários vêm primeiro, do mais perto para o mais longe`() {
        val queue =
            MemoryQueue.queue(
                listOf(
                    entry("antigo", "2020-03-01"),
                    entry("um-ano-quase", "2025-10-25"),
                    entry("dois-anos", "2024-10-18"),
                    entry("meses", "2026-04-01")
                ),
                today
            )
        assertEquals(listOf("dois-anos", "um-ano-quase"), queue.take(2).map { it.entry.id })
        assertEquals(setOf("antigo", "meses"), queue.drop(2).map { it.entry.id }.toSet())
    }

    @Test
    fun `fora dos aniversários, o mais antigo vem antes quando a diferença passa do desvio`() {
        val queue = MemoryQueue.queue(listOf(entry("recente", "2026-07-01"), entry("antigo", "2023-03-01")), today)
        assertEquals(listOf("antigo", "recente"), queue.map { it.entry.id })
    }

    @Test
    fun `a fila é a mesma o dia todo e pode mudar no dia seguinte`() {
        val entries = (1..40).map { entry("e$it", LocalDate.of(2026, 1, 1).plusDays(it.toLong() * 3).toString()) }
        val first = MemoryQueue.queue(entries, today).map { it.entry.id }
        assertEquals(first, MemoryQueue.queue(entries.shuffled(), today).map { it.entry.id })
        val days = (1L..10L).map { MemoryQueue.queue(entries, today.plusDays(it)).first().entry.id }.toSet()
        assertTrue(days.size > 1)
    }

    @Test
    fun `há quanto tempo, como no mock`() {
        assertEquals("Há 1 ano", MemoryQueue.agoLabel(365))
        assertEquals("Há 2 anos", MemoryQueue.agoLabel(735))
        assertEquals("Há 6 meses", MemoryQueue.agoLabel(183))
        assertEquals("Há 5 semanas", MemoryQueue.agoLabel(35))
        assertEquals("Há 10 dias", MemoryQueue.agoLabel(10))
    }

    @Test
    fun `distância do aniversário é infinita antes de perto de 1 ano`() {
        assertEquals(Double.POSITIVE_INFINITY, MemoryQueue.anniversaryGap(100), 0.0)
        assertEquals(0.25, MemoryQueue.anniversaryGap(365), 1e-9)
    }
}
