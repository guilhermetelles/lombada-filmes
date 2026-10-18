package io.github.guilhermetelles.lombada.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class QuizEventTest {
    private val all = (1..10).map { QuizEvent.idOf(it) }

    @Test
    fun `reconhece os ids do evento e não confunde com dias`() {
        assertTrue(QuizEvent.isEventId("inicio-01"))
        assertTrue(QuizEvent.isEventId("inicio-10"))
        assertEquals(3, QuizEvent.indexOf("inicio-03"))
        assertFalse(QuizEvent.isEventId("2026-10-18"))
        assertFalse(QuizEvent.isEventId("inicio-1"))
        assertFalse(QuizEvent.isEventId("inicio-00"))
        assertFalse(QuizEvent.isEventId("inicio-11"))
        assertFalse(QuizEvent.isEventId("inicio-01x"))
        assertNull(QuizEvent.indexOf("2026-10-18"))
    }

    @Test
    fun `ids com dois dígitos`() {
        assertEquals("inicio-01", QuizEvent.idOf(1))
        assertEquals("inicio-10", QuizEvent.idOf(10))
    }

    @Test
    fun `próxima não respondida segue a ordem do evento, não a da lista`() {
        val shuffled = all.reversed()
        assertEquals("inicio-01", QuizEvent.nextUnanswered(shuffled, emptySet()))
        assertEquals("inicio-03", QuizEvent.nextUnanswered(shuffled, setOf("inicio-01", "inicio-02")))
    }

    @Test
    fun `depois da atual, procura adiante e só então volta ao começo`() {
        // Respondeu a 5 pulando a 2: a próxima é a 6, e a 2 fica para depois da 10.
        val answered = setOf("inicio-01", "inicio-03", "inicio-04", "inicio-05")
        assertEquals("inicio-06", QuizEvent.nextUnanswered(all, answered, after = "inicio-05"))
        val almost = all.toSet() - setOf("inicio-02", "inicio-10")
        assertEquals("inicio-02", QuizEvent.nextUnanswered(all, almost + "inicio-10", after = "inicio-10"))
        // A atual nunca é a próxima, mesmo antes da resposta chegar pelo Firestore.
        assertEquals("inicio-02", QuizEvent.nextUnanswered(all, setOf("inicio-01"), after = "inicio-01"))
    }

    @Test
    fun `sem próxima quando tudo está respondido`() {
        assertNull(QuizEvent.nextUnanswered(all, all.toSet()))
        assertNull(QuizEvent.nextUnanswered(all, all.toSet() - "inicio-07", after = "inicio-07"))
        assertNull(QuizEvent.nextUnanswered(emptyList(), emptySet()))
    }

    @Test
    fun `progresso conta respondidas e acertos`() {
        val progress =
            QuizEvent.progress(all, mapOf("inicio-01" to true, "inicio-02" to false, "inicio-03" to true))
        assertEquals(QuizEventProgress(answered = 3, correct = 2, total = 10), progress)
        assertFalse(progress.done)
    }

    @Test
    fun `concluído com as 10 respondidas`() {
        val progress = QuizEvent.progress(all, all.associateWith { it != "inicio-04" })
        assertTrue(progress.done)
        assertEquals(9, progress.correct)
    }

    @Test
    fun `respostas de perguntas que não estão no evento não contam`() {
        val progress = QuizEvent.progress(all.take(2), mapOf("inicio-01" to true, "2026-10-18" to true))
        assertEquals(1, progress.answered)
        assertEquals(10, progress.total)
    }
}
