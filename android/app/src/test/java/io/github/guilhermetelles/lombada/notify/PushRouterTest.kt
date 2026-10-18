package io.github.guilhermetelles.lombada.notify

import io.github.guilhermetelles.lombada.data.model.RouteRef
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PushRouterTest {
    private val feed = RouteRef("feed")

    @Test
    fun `sem lista no push abre na lista ativa`() {
        assertEquals(PushStep.Open, PushRouter.stepFor(PushTarget(null, feed, null), "a", setOf("a", "b")))
    }

    @Test
    fun `mesma lista abre direto`() {
        assertEquals(PushStep.Open, PushRouter.stepFor(PushTarget("a", feed, null), "a", null))
    }

    @Test
    fun `outra lista da pessoa troca antes`() {
        assertEquals(PushStep.SwitchList("b"), PushRouter.stepFor(PushTarget("b", feed, null), "a", setOf("a", "b")))
    }

    @Test
    fun `lista de que a pessoa saiu abre na ativa`() {
        assertEquals(PushStep.Open, PushRouter.stepFor(PushTarget("c", feed, null), "a", setOf("a", "b")))
    }

    @Test
    fun `sem saber as listas tenta trocar`() {
        assertEquals(PushStep.SwitchList("b"), PushRouter.stepFor(PushTarget("b", feed, null), "a", null))
    }

    @Test
    fun `consumir só limpa o mesmo destino`() {
        val first = PushTarget("a", feed, "1")
        val second = PushTarget("a", feed, "2")
        PushRouter.offer(first)
        PushRouter.offer(second)
        PushRouter.consume(first)
        assertEquals(second, PushRouter.pending.value)
        PushRouter.consume(second)
        assertNull(PushRouter.pending.value)
    }
}
