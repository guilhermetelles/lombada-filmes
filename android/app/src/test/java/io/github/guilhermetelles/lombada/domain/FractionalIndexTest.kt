package io.github.guilhermetelles.lombada.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Compara o porte com os casos gerados pela biblioteca em JS (`scripts/generate-fractional-indexing-cases.mjs`). */
class FractionalIndexTest {
    private val lines =
        requireNotNull(javaClass.classLoader)
            .getResource("fractional-indexing-cases.txt")
            .let(::requireNotNull)
            .readText()
            .lines()
            .filter { it.isNotBlank() }

    private fun key(text: String): String? = text.takeUnless { it == "-" }

    @Test
    fun `gera as mesmas chaves que a biblioteca em JS`() {
        val cases = lines.filterNot { it.startsWith("#") }
        assertTrue(cases.size > 600)
        for (line in cases) {
            val (a, b, expected) = line.split(" ")
            assertEquals("entre $a e $b", expected, FractionalIndex.keyBetween(key(a), key(b)))
        }
    }

    @Test
    fun `gera várias chaves como a biblioteca em JS`() {
        for (line in lines.filter { it.startsWith("#N") }) {
            val (_, a, b, n, expected) = line.split(" ")
            assertEquals(expected.split(","), FractionalIndex.keysBetween(key(a), key(b), n.toInt()))
        }
    }

    @Test
    fun `as chaves ordenam por texto`() {
        val keys = FractionalIndex.keysBetween(null, null, 91)
        assertEquals(keys.sorted(), keys)
        val between = FractionalIndex.keyBetween(keys[10], keys[11])
        assertTrue(keys[10] < between && between < keys[11])
    }
}
