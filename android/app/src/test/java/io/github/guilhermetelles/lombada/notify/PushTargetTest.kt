package io.github.guilhermetelles.lombada.notify

import io.github.guilhermetelles.lombada.data.model.RouteArgs
import io.github.guilhermetelles.lombada.data.model.RouteRef
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PushTargetTest {
    private fun parse(vararg pairs: Pair<String, String?>): PushTarget? {
        val map = pairs.toMap()
        return PushTarget.parse { map[it] }
    }

    @Test
    fun `abertura comum sem extras não tem destino`() {
        assertNull(parse())
        assertNull(parse("listId" to "", "route" to "  ", "feedId" to null))
    }

    @Test
    fun `lê lista, rota e item do feed`() {
        val target =
            parse("listId" to "k3x9", "route" to """{"name":"movie","args":{"tmdbId":603}}""", "feedId" to "f1")
        assertEquals(PushTarget("k3x9", RouteRef("movie", RouteArgs(tmdbId = 603)), "f1"), target)
    }

    @Test
    fun `rota sem args e com campos desconhecidos`() {
        assertEquals(RouteRef("feed"), parse("route" to """{"name":"feed"}""")?.route)
        assertEquals(
            RouteRef("quizPlay", RouteArgs(day = "2026-10-18")),
            parse("route" to """{"name":"quizPlay","args":{"day":"2026-10-18","extra":1},"v":2}""")?.route
        )
    }

    @Test
    fun `rota inválida vira nula sem perder a lista`() {
        val target = parse("listId" to "k3x9", "route" to "{nao e json")
        assertEquals("k3x9", target?.listId)
        assertNull(target?.route)
        assertNull(parse("route" to """{"args":{}}""")?.route)
        assertNull(parse("route" to """{"name":""}""")?.route)
        assertNull(parse("route" to """{"name":"movie","args":{"tmdbId":"abc"}}""")?.route)
    }

    @Test
    fun `espaços em volta são ignorados`() {
        assertEquals("k3x9", parse("listId" to " k3x9 ")?.listId)
    }
}
