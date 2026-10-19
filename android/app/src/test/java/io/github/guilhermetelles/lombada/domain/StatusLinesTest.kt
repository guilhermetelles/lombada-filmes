package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.CallCount
import io.github.guilhermetelles.lombada.data.model.GeminiInfo
import io.github.guilhermetelles.lombada.data.model.GeminiModelUsage
import io.github.guilhermetelles.lombada.data.model.SourceUsage
import io.github.guilhermetelles.lombada.data.model.StatusUsageDay
import io.github.guilhermetelles.lombada.data.model.UsageDay
import java.time.Instant
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class StatusLinesTest {
    // 2026-10-19 12:00 em Brasília.
    private val now = Instant.parse("2026-10-19T15:00:00Z")

    @Test
    fun `quando rodou, no fuso de Brasília`() {
        assertEquals("hoje às 05:56", StatusLines.lastRunLabel("2026-10-19T08:56:00Z", now))
        // 01:30 UTC do dia 19 ainda é dia 18 em Brasília.
        assertEquals("ontem às 22:30", StatusLines.lastRunLabel("2026-10-19T01:30:00Z", now))
        assertEquals("em 12/10 às 05:00", StatusLines.lastRunLabel("2026-10-12T08:00:00Z", now))
        assertEquals("ainda não rodou", StatusLines.lastRunLabel(null, now))
        assertEquals("ainda não rodou", StatusLines.lastRunLabel("ontem", now))
    }

    @Test
    fun `nomes das rotinas e estados`() {
        assertEquals("Avisos das 9h", StatusLines.jobName("notify-09"))
        assertEquals("Sugestões", StatusLines.jobName("cron/_recs.ts"))
        assertEquals("rotina-nova", StatusLines.jobName("rotina-nova"))
        assertEquals(JobHealth.Partial, JobHealth.fromWire("partial"))
        assertEquals(JobHealth.Unknown, JobHealth.fromWire("??"))
    }

    @Test
    fun `duração legível`() {
        assertEquals("0,8 s", StatusLines.durationLabel(800))
        assertEquals("42 s", StatusLines.durationLabel(42_300))
        assertEquals("3 min 5 s", StatusLines.durationLabel(185_000))
        assertEquals("4 min", StatusLines.durationLabel(240_000))
        assertNull(StatusLines.durationLabel(null))
    }

    @Test
    fun `tabela por fonte na ordem fixa, dias em ordem e sem fontes paradas`() {
        val usage =
            listOf(
                StatusUsageDay("2026-10-19", mapOf("omdb" to CallCount(3, 1), "tmdb" to CallCount(10))),
                StatusUsageDay("2026-10-18", mapOf("tmdb" to CallCount(5), "novo" to CallCount(2))),
                StatusUsageDay("2026-10-17", mapOf("bechdel" to CallCount(0)))
            )
        val table = StatusLines.usageTable(usage)
        assertEquals(listOf("2026-10-19", "2026-10-18", "2026-10-17"), table.days.map { it.toString() })
        assertEquals(listOf("tmdb", "omdb", "novo"), table.rows.map { it.source })
        assertEquals(listOf(10, 5, 0), table.rows[0].calls)
        assertEquals(15, table.rows[0].totalCalls)
        assertEquals(1, table.rows[1].totalErrors)
    }

    @Test
    fun `modelos do Gemini na ordem do backend com o consumo de hoje`() {
        val gemini = GeminiInfo(interpret = listOf("flash", "flash-lite"), text = listOf("flash-lite", "pro"))
        val usage =
            listOf(
                StatusUsageDay(
                    "2026-10-19",
                    geminiModels = mapOf(
                        "flash" to GeminiModelUsage(20, 2, 20),
                        "extra" to GeminiModelUsage(1)
                    )
                ),
                StatusUsageDay("2026-10-18", geminiModels = mapOf("pro" to GeminiModelUsage(9)))
            )
        val lines = StatusLines.geminiToday(gemini, usage, LocalDate.of(2026, 10, 19))
        assertEquals(listOf("flash", "flash-lite", "pro", "extra"), lines.map { it.model })
        assertEquals(20, lines[0].calls)
        assertEquals(20, lines[0].quota)
        assertEquals(0, lines[2].calls)
        assertEquals(
            emptyList<GeminiModelLine>(),
            StatusLines.geminiToday(null, emptyList(), LocalDate.of(2026, 10, 19))
        )
    }

    @Test
    fun `dias sem registro entram zerados nas colunas`() {
        val today = LocalDate.of(2026, 10, 19)
        val read = listOf(UsageDay(LocalDate.of(2026, 10, 17), mapOf("tmdb" to SourceUsage(4, 0, 0, null))))
        val days = StatusLines.fillDays(read, today, 3)
        assertEquals(listOf(17, 18, 19), days.map { it.day.dayOfMonth })
        assertEquals(listOf(4, 0, 0), days.map { it.totalCalls })
    }
}
