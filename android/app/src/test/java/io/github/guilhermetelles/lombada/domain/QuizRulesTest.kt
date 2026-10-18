package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.QuizAnswer
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class QuizRulesTest {
    private fun at(iso: String): Clock = Clock.fixed(Instant.parse(iso), ZoneOffset.UTC)

    @Test
    fun `a pergunta sai às 05h30 de Brasília, 08h30 UTC`() {
        assertTrue(QuizRules.beforeRelease(at("2026-10-18T08:29:59Z")))
        assertFalse(QuizRules.beforeRelease(at("2026-10-18T08:30:00Z")))
        // 02h UTC ainda é o fim do dia anterior em Brasília, bem depois do horário.
        assertFalse(QuizRules.beforeRelease(at("2026-10-18T02:00:00Z")))
        assertTrue(QuizRules.beforeRelease(at("2026-10-18T03:00:00Z")))
    }

    @Test
    fun `nomes dos tipos`() {
        assertEquals("Comentário", QuizRules.typeTitle("trecho"))
        assertEquals("Orçamento", QuizRules.typeTitle("bilheteria"))
        assertEquals("Quiz", QuizRules.typeTitle("novo"))
    }

    @Test
    fun `certa guardada vence, senão a de quem acertou`() {
        val wrong = QuizAnswer("ana", "b", false, null)
        val right = QuizAnswer("bia", "c", true, null)
        assertEquals("d", QuizRules.rightOption("d", listOf(wrong, right)))
        assertEquals("c", QuizRules.rightOption(null, listOf(wrong, right)))
        assertNull(QuizRules.rightOption(null, listOf(wrong)))
    }
}
