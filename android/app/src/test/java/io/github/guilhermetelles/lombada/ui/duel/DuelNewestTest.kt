package io.github.guilhermetelles.lombada.ui.duel

import io.github.guilhermetelles.lombada.data.model.Duel
import io.github.guilhermetelles.lombada.data.model.DuelChoice
import io.github.guilhermetelles.lombada.data.model.DuelStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DuelNewestTest {
    private fun duel(status: DuelStatus, vararg votes: Pair<String, DuelChoice>) =
        Duel("2026-10-28", "e1", "e2", status, votes.toMap())

    @Test
    fun `sem uma das versões, usa a outra`() {
        val open = duel(DuelStatus.OPEN)
        assertEquals(open, newest(open, null))
        assertEquals(open, newest(null, open))
        assertNull(newest(null, null))
    }

    @Test
    fun `o voto devolvido pelo backend vale até o Firestore alcançar`() {
        val voted = duel(DuelStatus.OPEN, "ana" to DuelChoice.SWAP)
        assertEquals(voted, newest(voted, duel(DuelStatus.OPEN)))
    }

    @Test
    fun `o Firestore traz o voto de outro membro`() {
        val live = duel(DuelStatus.OPEN, "ana" to DuelChoice.SWAP, "bia" to DuelChoice.SWAP)
        assertEquals(live, newest(duel(DuelStatus.OPEN, "ana" to DuelChoice.SWAP), live))
    }

    @Test
    fun `fechado vence aberto, dos dois lados`() {
        val open = duel(DuelStatus.OPEN, "ana" to DuelChoice.SWAP)
        val kept = duel(DuelStatus.KEPT, "bia" to DuelChoice.KEEP)
        assertEquals(kept, newest(open, kept))
        assertEquals(kept, newest(kept, open))
    }
}
