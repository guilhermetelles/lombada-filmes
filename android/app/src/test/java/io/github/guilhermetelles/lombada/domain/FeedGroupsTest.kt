package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.FeedItem
import java.time.Instant
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Test

class FeedGroupsTest {
    private val today = LocalDate.of(2026, 10, 18)

    private fun item(id: String, kind: String, at: String?) =
        FeedItem(id, "daily.curio", kind, at?.let(Instant::parse), null, "título $id", null, null, null)

    private val items =
        listOf(
            item("agora", "lista", null),
            item("hoje", "quiz", "2026-10-18T12:00:00Z"),
            // 01h UTC do dia 18 ainda é dia 17 em Brasília.
            item("ontem", "curiosidade", "2026-10-18T01:00:00Z"),
            item("semana", "lembrete", "2026-10-12T15:00:00Z"),
            item("antes", "lista", "2026-10-11T15:00:00Z")
        )

    @Test
    fun `agrupa por dia de Brasília`() {
        val groups = FeedGroups.group(items, FeedFilter.All, today)
        assertEquals(listOf("Hoje", "Ontem", "Esta semana", "Antes"), groups.map { it.label })
        assertEquals(listOf("agora", "hoje"), groups[0].items.map { it.id })
        assertEquals(listOf("ontem"), groups[1].items.map { it.id })
    }

    @Test
    fun `filtro por kind tira os grupos vazios`() {
        val groups = FeedGroups.group(items, FeedFilter.List, today)
        assertEquals(listOf("Hoje", "Antes"), groups.map { it.label })
        assertEquals(emptyList<FeedGroup>(), FeedGroups.group(emptyList(), FeedFilter.Quiz, today))
    }

    @Test
    fun `horário em hoje e ontem, data nos outros dias`() {
        assertEquals("09:00", FeedGroups.timeLabel(Instant.parse("2026-10-18T12:00:00Z"), today))
        assertEquals("22:00", FeedGroups.timeLabel(Instant.parse("2026-10-18T01:00:00Z"), today))
        assertEquals("12/10", FeedGroups.timeLabel(Instant.parse("2026-10-12T15:00:00Z"), today))
        assertEquals("", FeedGroups.timeLabel(null, today))
    }
}
