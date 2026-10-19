package io.github.guilhermetelles.lombada.events

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PendingEventsTest {
    private fun moved(id: String) = PendingEvent(ListEventType.Moved.wire, id)

    @Test
    fun `mover três vezes a mesma entrada vira um evento só`() {
        var pending = emptyList<PendingEvent>()
        repeat(3) { pending = PendingEvents.add(pending, moved("e1")) }
        assertEquals(listOf(moved("e1")), pending)
        assertEquals(listOf(moved("e1")), PendingEvents.nextBatch(pending))
    }

    @Test
    fun `tipos diferentes da mesma entrada ficam`() {
        val pending =
            listOf(ListEventType.Added, ListEventType.Commented, ListEventType.Moved)
                .fold(emptyList<PendingEvent>()) { acc, type -> PendingEvents.add(acc, PendingEvent(type.wire, "e1")) }
        assertEquals(listOf("added", "commented", "moved"), pending.map { it.type })
    }

    @Test
    fun `lote de até 50, os mais antigos primeiro`() {
        val pending = (1..70).map { moved("e$it") }
        val batch = PendingEvents.nextBatch(pending)
        assertEquals(50, batch.size)
        assertEquals("e1", batch.first().entryId)
        val rest = PendingEvents.removeSent(pending, batch)
        assertEquals((51..70).map { "e$it" }, rest.map { it.entryId })
    }

    @Test
    fun `o que chegou durante o envio continua na fila`() {
        val sent = listOf(moved("e1"))
        val now = listOf(moved("e1"), moved("e2"))
        assertEquals(listOf(moved("e2")), PendingEvents.removeSent(now, sent))
    }

    @Test
    fun `desfazer a adição tira os eventos da entrada`() {
        val pending = listOf(PendingEvent("added", "e1"), moved("e2"), PendingEvent("commented", "e1"))
        assertEquals(listOf(moved("e2")), PendingEvents.withoutEntry(pending, "e1"))
    }

    @Test
    fun `a fila local tem teto e perde os mais antigos`() {
        val pending = (1..250).fold(emptyList<PendingEvent>()) { acc, n -> PendingEvents.add(acc, moved("e$n")) }
        assertEquals(200, pending.size)
        assertEquals("e51", pending.first().entryId)
    }

    @Test
    fun `adição pendente só enquanto o added não saiu da fila`() {
        val added = PendingEvent(ListEventType.Added.wire, "e1")
        val pending = listOf(added, moved("e1"), moved("e2"))
        assertTrue(PendingEvents.hasPendingAdd(pending, "e1"))
        assertFalse(PendingEvents.hasPendingAdd(pending, "e2"))
        val afterSend = PendingEvents.removeSent(pending, listOf(added))
        assertFalse(PendingEvents.hasPendingAdd(afterSend, "e1"))
    }

    @Test
    fun `mudanças esperando conexão só sem internet`() {
        assertEquals(3, PendingEvents.waiting(3, online = false))
        assertEquals(0, PendingEvents.waiting(3, online = true))
        assertEquals("1 mudança esperando conexão", PendingEvents.waitingLabel(1))
        assertEquals("4 mudanças esperando conexão", PendingEvents.waitingLabel(4))
    }
}
