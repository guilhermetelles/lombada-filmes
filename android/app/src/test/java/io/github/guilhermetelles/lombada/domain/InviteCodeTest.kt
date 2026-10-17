package io.github.guilhermetelles.lombada.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class InviteCodeTest {
    @Test
    fun `normaliza o que a pessoa digita`() {
        assertEquals("7Q4KMX", InviteCode.normalize(" 7q4-kmx "))
    }

    @Test
    fun `formata com o traço a partir do quarto caractere`() {
        assertEquals("7Q4", InviteCode.format("7Q4"))
        assertEquals("7Q4-K", InviteCode.format("7Q4K"))
        assertEquals("7Q4-KMX", InviteCode.format("7Q4KMX"))
    }

    @Test
    fun `aceita só 6 caracteres do alfabeto`() {
        assertTrue(InviteCode.isWellFormed("7Q4KMX"))
        assertFalse(InviteCode.isWellFormed("7Q4KM"))
        assertFalse(InviteCode.isWellFormed("7Q4KM0"))
        assertFalse(InviteCode.isWellFormed("IQ4KMX"))
    }
}
