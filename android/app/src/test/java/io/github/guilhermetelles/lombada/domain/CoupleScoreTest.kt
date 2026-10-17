package io.github.guilhermetelles.lombada.domain

import org.junit.Assert.assertEquals
import org.junit.Test

class CoupleScoreTest {
    @Test
    fun `vai de 10 no primeiro a 1 no último`() {
        assertEquals(10.0, CoupleScore.of(1, 91), 1e-9)
        assertEquals(1.0, CoupleScore.of(91, 91), 1e-9)
        assertEquals(5.5, CoupleScore.of(46, 91), 1e-9)
    }

    @Test
    fun `lista com um filme dá 10`() {
        assertEquals(10.0, CoupleScore.of(1, 1), 1e-9)
    }

    @Test
    fun `bate com o mock para o segundo de 91`() {
        assertEquals("9.9", Formatting.oneDecimal(CoupleScore.of(2, 91)))
    }
}
