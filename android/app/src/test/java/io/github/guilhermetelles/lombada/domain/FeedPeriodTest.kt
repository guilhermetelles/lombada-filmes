package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.FeedItem
import java.time.Instant
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FeedPeriodTest {
    private val now = Instant.parse("2026-10-18T15:00:00Z")
    private val seen = Instant.parse("2026-10-18T10:00:00Z")

    private fun item(id: String, kind: String, at: String?) =
        FeedItem(id, "daily.curio", kind, at?.let(Instant::parse), null, "título $id", null, null, null)

    @Test
    fun `corte de cada período a partir de agora`() {
        assertEquals(Instant.parse("2026-10-17T15:00:00Z"), FeedPeriods.since(FeedPeriod.Day, now, seen))
        assertEquals(Instant.parse("2026-10-11T15:00:00Z"), FeedPeriods.since(FeedPeriod.Week, now, seen))
        assertEquals(Instant.parse("2026-09-18T15:00:00Z"), FeedPeriods.since(FeedPeriod.Month, now, seen))
        assertNull(FeedPeriods.since(FeedPeriod.All, now, seen))
    }

    @Test
    fun `novas usa a visita anterior e, sem ela, mostra tudo`() {
        assertEquals(seen, FeedPeriods.since(FeedPeriod.New, now, seen))
        assertNull(FeedPeriods.since(FeedPeriod.New, now, null))
    }

    @Test
    fun `item entra só depois do corte e sem horário conta como agora`() {
        assertTrue(FeedPeriods.includes(Instant.parse("2026-10-18T10:00:01Z"), seen))
        assertFalse(FeedPeriods.includes(seen, seen))
        assertFalse(FeedPeriods.includes(Instant.parse("2026-10-01T00:00:00Z"), seen))
        assertTrue(FeedPeriods.includes(null, seen))
        assertTrue(FeedPeriods.includes(Instant.parse("2000-01-01T00:00:00Z"), null))
    }

    @Test
    fun `período e tipo combinam no agrupamento`() {
        val items =
            listOf(
                item("hoje-lista", "lista", "2026-10-18T12:00:00Z"),
                item("hoje-quiz", "quiz", "2026-10-18T11:00:00Z"),
                item("velho-lista", "lista", "2026-09-01T12:00:00Z")
            )
        val since = FeedPeriods.since(FeedPeriod.Week, now, seen)
        val groups = FeedGroups.group(items, FeedFilter.List, LocalDate.of(2026, 10, 18), since)
        assertEquals(listOf("Hoje"), groups.map { it.label })
        assertEquals(listOf("hoje-lista"), groups[0].items.map { it.id })
    }

    @Test
    fun `período guardado volta, e o desconhecido vira o padrão`() {
        assertEquals(FeedPeriod.Week, FeedPeriod.DEFAULT)
        assertEquals(FeedPeriod.Month, FeedPeriod.fromKey("Month"))
        assertEquals(FeedPeriod.DEFAULT, FeedPeriod.fromKey(null))
        assertEquals(FeedPeriod.DEFAULT, FeedPeriod.fromKey("Ano"))
    }

    @Test
    fun `estado vazio oferece ver tudo só quando há corte`() {
        val novas = FeedPeriods.emptyMessage(FeedPeriod.New, FeedFilter.All)
        assertEquals("Nada novo desde a sua última visita.", novas.title)
        assertTrue(novas.offerAll)
        assertEquals("Nada nas últimas 24 horas.", FeedPeriods.emptyMessage(FeedPeriod.Day, FeedFilter.Quiz).title)
        assertFalse(FeedPeriods.emptyMessage(FeedPeriod.All, FeedFilter.All).offerAll)
        assertEquals("Nada desse tipo ainda", FeedPeriods.emptyMessage(FeedPeriod.All, FeedFilter.Quiz).title)
    }
}
