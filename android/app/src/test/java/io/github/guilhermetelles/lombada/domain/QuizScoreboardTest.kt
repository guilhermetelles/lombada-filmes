package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Scores
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class QuizScoreboardTest {
    private val members = listOf("ana", "bia")

    private val history =
        listOf(
            Scores("2026-10", mapOf("ana" to 20, "bia" to 30), emptyList()),
            Scores("2026-09", mapOf("ana" to 50, "bia" to 40, "saiu" to 90), listOf("ana")),
            Scores("2026-08", mapOf("ana" to 10, "bia" to 10), listOf("ana", "bia")),
            Scores("2026-03", mapOf("ana" to 70), listOf("ana"))
        )

    @Test
    fun `placar do mês do maior para o menor, com todos os membros`() {
        val rows = QuizScoreboard.rows(members, history.first(), me = "ana")
        assertEquals(listOf("bia" to 30, "ana" to 20), rows.map { it.uid to it.points })
        assertEquals(listOf(false, true), rows.map { it.isMe })
    }

    @Test
    fun `empate mantém a ordem dos membros e sem placar todos têm zero`() {
        assertEquals(listOf("ana", "bia"), QuizScoreboard.rows(members, history[2], "bia").map { it.uid })
        assertEquals(listOf(0, 0), QuizScoreboard.rows(members, null, "bia").map { it.points })
    }

    @Test
    fun `recordes contam meses fechados vencidos e somam o total`() {
        val records = QuizScoreboard.records(members, history, "2026-10", me = "ana")
        val ana = records.first { it.uid == "ana" }
        val bia = records.first { it.uid == "bia" }
        assertEquals(3, ana.monthsWon)
        assertEquals(1, bia.monthsWon)
        assertEquals(150, ana.total)
        assertEquals(80, bia.total)
        assertEquals(20, ana.monthPoints)
        assertEquals("bia", records.first().uid)
    }

    @Test
    fun `últimos seis meses só com os que têm placar e sem vencedor no mês atual`() {
        val months = QuizScoreboard.recentMonths(members, history, "2026-10")
        assertEquals(listOf("2026-10", "2026-09", "2026-08"), months.map { it.month })
        assertEquals(listOf(true, false, false), months.map { it.current })
        assertEquals(emptyList<String>(), months.first().winnerUids)
        assertEquals(listOf("ana" to 50, "bia" to 40), months[1].points)
    }

    @Test
    fun `vencedor do mês passado só quando gravado`() {
        assertEquals("2026-09", QuizScoreboard.lastMonthWinners(history, "2026-10")?.month)
        assertNull(QuizScoreboard.lastMonthWinners(history, "2026-11"))
        assertNull(QuizScoreboard.lastMonthWinners(listOf(Scores("2026-09", emptyMap(), emptyList())), "2026-10"))
    }

    @Test
    fun `virada de ano e nomes dos meses`() {
        val janHistory = listOf(Scores("2025-12", mapOf("ana" to 10), listOf("ana")))
        assertEquals("2025-12", QuizScoreboard.lastMonthWinners(janHistory, "2026-01")?.month)
        assertEquals("dezembro de 2025", QuizScoreboard.monthLabel("2025-12"))
        assertEquals("março", QuizScoreboard.monthName("2026-03"))
    }
}
