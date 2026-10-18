package io.github.guilhermetelles.lombada.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DiscoverKeywordsTest {
    private val shark = Keyword(15097, "tubarão")
    private val island = Keyword(1405, "ilha")

    @Test
    fun `junta sem repetir id e a que volta passa a ser a mais nova`() {
        val merged = DiscoverKeywords.merge(
            listOf(shark, island),
            listOf(Keyword(15097, "tubarões"), Keyword(9, "praia"))
        )
        assertEquals(listOf(island, Keyword(15097, "tubarões"), Keyword(9, "praia")), merged)
    }

    @Test
    fun `repetidas na mesma resposta entram uma vez`() {
        assertEquals(listOf(shark), DiscoverKeywords.merge(emptyList(), listOf(shark, shark.copy(label = "outro"))))
    }

    @Test
    fun `fica com as cinco mais novas`() {
        val current = (1..4).map { Keyword(it, "p$it") }
        val merged = DiscoverKeywords.merge(current, listOf(Keyword(5, "p5"), Keyword(6, "p6"), Keyword(7, "p7")))
        assertEquals(listOf(3, 4, 5, 6, 7), merged.map { it.id })
    }

    @Test
    fun `descarta palavra sem id válido ou sem rótulo e apara o rótulo`() {
        val merged = DiscoverKeywords.merge(
            emptyList(),
            listOf(Keyword(0, "zero"), Keyword(3, "  "), Keyword(4, " ilha "))
        )
        assertEquals(listOf(Keyword(4, "ilha")), merged)
    }

    @Test
    fun `monta o kw com os ids na ordem e nada sem palavras`() {
        assertEquals("15097,1405", DiscoverKeywords.param(listOf(shark, island)))
        assertNull(DiscoverKeywords.param(emptyList()))
    }

    @Test
    fun `linha Tem com as que casaram na ordem do estado`() {
        val keywords = listOf(shark, island, Keyword(9, "praia"))
        assertEquals("Tem: tubarão, ilha", DiscoverKeywords.matchedLine(keywords, listOf(1405, 15097)))
        assertNull(DiscoverKeywords.matchedLine(keywords, emptyList()))
        assertNull(DiscoverKeywords.matchedLine(keywords, listOf(42)))
    }
}
