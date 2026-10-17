package io.github.guilhermetelles.lombada.domain

import org.junit.Assert.assertEquals
import org.junit.Test

class RecentListsTest {
    @Test
    fun `lê o texto vazio como nenhuma lista`() {
        assertEquals(emptyList<String>(), RecentLists.parse(""))
        assertEquals(emptyList<String>(), RecentLists.parse(null))
    }

    @Test
    fun `visitar põe na frente sem repetir`() {
        assertEquals(listOf("b", "a", "c"), RecentLists.visit(listOf("a", "b", "c"), "b"))
        assertEquals("d,a", RecentLists.serialize(RecentLists.visit(RecentLists.parse("a"), "d")))
    }

    @Test
    fun `visitar corta no máximo das regras`() {
        val many = (1..RecentLists.MAX).map { "l$it" }
        val visited = RecentLists.visit(many, "novo")
        assertEquals(RecentLists.MAX, visited.size)
        assertEquals("novo", visited.first())
    }

    @Test
    fun `esquecer tira a lista`() {
        assertEquals(listOf("a", "c"), RecentLists.forget(listOf("a", "b", "c"), "b"))
    }
}
