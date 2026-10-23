package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.CallCount
import io.github.guilhermetelles.lombada.data.model.GeminiInfo
import io.github.guilhermetelles.lombada.data.model.GeminiModelUsage
import io.github.guilhermetelles.lombada.data.model.GeminiPurposeUsage
import io.github.guilhermetelles.lombada.data.model.GeminiResting
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

    @Test
    fun `resumo e detalhe de um modelo, com erros por tipo e tempo medio`() {
        val line =
            GeminiModelLine(
                model = "flash",
                calls = 7,
                errors = 5,
                quota = 1,
                answered = 2,
                unavailable = 2,
                timeout = 1,
                format = 0,
                latencyMs = 3_600
            )
        assertEquals("2 de 7 respondidos", StatusLines.geminiModelSummary(line))
        assertEquals(
            "média 1,8 s · 1 × sem cota · 2 × fora do ar · 1 × sem resposta · 1 × outro erro",
            StatusLines.geminiModelDetail(line)
        )
        // Backend antigo, sem respostas: só os pedidos.
        val old = GeminiModelLine("pro", calls = 3, errors = 0, quota = null)
        assertEquals("3 pedidos", StatusLines.geminiModelSummary(old))
        assertEquals("", StatusLines.geminiModelDetail(old))
        assertEquals("nenhum pedido", StatusLines.geminiModelSummary(GeminiModelLine("x", 0, 0, null)))
    }

    @Test
    fun `usos do Gemini de hoje na ordem fixa, com respondidos e falhas`() {
        val usage =
            listOf(
                StatusUsageDay(
                    "2026-10-19",
                    geminiPurposes =
                        mapOf(
                            "quiz" to GeminiPurposeUsage(1, 1, 0),
                            "search" to GeminiPurposeUsage(10, 8, 2),
                            "retro" to GeminiPurposeUsage(0, 0, 0),
                            "novo" to GeminiPurposeUsage(1, 0, 1)
                        )
                ),
                StatusUsageDay("2026-10-18", geminiPurposes = mapOf("recs" to GeminiPurposeUsage(5, 5, 0)))
            )
        val lines = StatusLines.geminiPurposesToday(usage, LocalDate.of(2026, 10, 19))
        assertEquals(listOf("Busca em texto livre", "Quiz", "novo"), lines.map { it.label })
        assertEquals("8 de 10 respondidos · 2 falharam", StatusLines.geminiPurposeLabel(lines[0]))
        assertEquals("1 de 1 respondido", StatusLines.geminiPurposeLabel(lines[1]))
        assertEquals("0 de 1 respondido · 1 falhou", StatusLines.geminiPurposeLabel(lines[2]))
    }

    @Test
    fun `modelos pulados com o motivo e o horario de Brasilia`() {
        // 19/10/2026, 15h de Brasília.
        val now = Instant.parse("2026-10-19T18:00:00Z")
        val gemini =
            GeminiInfo(
                resting =
                    listOf(
                        GeminiResting("velho", "2026-10-19T17:00:00Z", "quota"),
                        GeminiResting("lite", "2026-10-19T18:05:00Z", "unavailable"),
                        GeminiResting("flash", "2026-10-20T07:00:00Z", "quota"),
                        GeminiResting("pro", "2026-10-22T07:00:00Z", "quota")
                    )
            )
        assertEquals(
            listOf(
                GeminiRestingLine("lite", "fora do ar até 15:05"),
                GeminiRestingLine("flash", "sem cota até amanhã às 04:00"),
                GeminiRestingLine("pro", "sem cota até 22/10 às 04:00")
            ),
            StatusLines.geminiResting(gemini, now)
        )
        assertEquals(emptyList<GeminiRestingLine>(), StatusLines.geminiResting(null, now))
    }

    @Test
    fun `Groq aparece como fonte antes do Gemini`() {
        val usage =
            listOf(
                StatusUsageDay(
                    "2026-10-23",
                    sources = mapOf("gemini" to CallCount(2, 1), "groq" to CallCount(5, 1))
                )
            )
        val table = StatusLines.usageTable(usage)
        assertEquals(listOf("groq", "gemini"), table.rows.map { it.source })
        assertEquals(listOf("Groq", "Gemini"), table.rows.map { it.name })
    }
}
