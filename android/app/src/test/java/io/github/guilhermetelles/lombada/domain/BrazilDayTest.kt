package io.github.guilhermetelles.lombada.domain

import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import org.junit.Assert.assertEquals
import org.junit.Test

class BrazilDayTest {
    private fun at(iso: String): Clock = Clock.fixed(Instant.parse(iso), ZoneOffset.UTC)

    @Test
    fun `00h UTC ainda é o dia anterior em Brasília`() {
        assertEquals("2026-10-17", BrazilDay.todayId(at("2026-10-18T00:00:00Z")))
        assertEquals("2026-10-17", BrazilDay.todayId(at("2026-10-18T02:59:59Z")))
    }

    @Test
    fun `o dia vira às 03h UTC, meia-noite em Brasília`() {
        assertEquals("2026-10-18", BrazilDay.todayId(at("2026-10-18T03:00:00Z")))
        assertEquals(LocalDate.of(2026, 10, 18), BrazilDay.of(Instant.parse("2026-10-18T23:59:59Z")))
    }

    @Test
    fun `o mês segue o dia de Brasília`() {
        assertEquals("2026-10", BrazilDay.monthId(at("2026-11-01T02:00:00Z")))
        assertEquals("2026-11", BrazilDay.monthId(at("2026-11-01T03:00:00Z")))
    }

    @Test
    fun `a virada do ano também`() {
        assertEquals("2026-12-31", BrazilDay.todayId(at("2027-01-01T00:00:00Z")))
        assertEquals("2026-12", BrazilDay.monthId(at("2027-01-01T00:00:00Z")))
    }
}
