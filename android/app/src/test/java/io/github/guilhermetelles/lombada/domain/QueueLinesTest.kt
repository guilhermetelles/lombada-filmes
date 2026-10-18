package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.MemberProfile
import io.github.guilhermetelles.lombada.data.model.QueueItem
import java.time.Instant
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class QueueLinesTest {
    private val today = LocalDate.parse("2026-10-18")
    private val profiles = mapOf("b" to MemberProfile("Ana", null))

    @Test
    fun `esconde os da lista e põe o mais recente primeiro`() {
        val queue =
            listOf(
                QueueItem(1, "a", Instant.parse("2026-10-10T12:00:00Z")),
                QueueItem(2, "a", Instant.parse("2026-10-15T12:00:00Z")),
                QueueItem(3, "b", null),
                QueueItem(4, "b", Instant.parse("2026-10-17T12:00:00Z"))
            )
        assertEquals(listOf(3, 2, 1), QueueLines.visible(queue, inList = setOf(4)).map { it.tmdbId })
    }

    @Test
    fun `quem pediu e quando, no fuso de Brasília`() {
        // 01:00 UTC do dia 18 ainda é dia 17 em Brasília.
        val yesterday = QueueItem(1, "b", Instant.parse("2026-10-18T01:00:00Z"))
        assertEquals("Ana pediu · 17/10/26", QueueLines.requester(yesterday, "a", profiles, today))
        val mine = QueueItem(1, "a", Instant.parse("2026-10-18T15:00:00Z"))
        assertEquals("Você pediu · hoje", QueueLines.requester(mine, "a", profiles, today))
        val unknown = QueueItem(1, "c", null)
        assertEquals("Alguém da lista pediu", QueueLines.requester(unknown, "a", profiles, today))
    }

    @Test
    fun `onde assistir`() {
        assertNull(QueueLines.where(null))
        assertEquals("Em nenhum streaming por assinatura agora", QueueLines.where(emptyList()))
        assertEquals(
            "Onde assistir: Netflix, Max, Prime Video e Disney+",
            QueueLines.where(listOf("Netflix", "Max", "Prime Video", "Disney+", "Globoplay"))
        )
    }
}
