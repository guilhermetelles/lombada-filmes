package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.MovieSnapshot
import io.github.guilhermetelles.lombada.data.model.RecItem
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RecsLinesTest {
    private fun rec(id: Int, kind: String = "tema", source: String = "model", reasonFrom: List<String> = emptyList()) =
        RecItem(id, "Filme $id", 2000, null, 100, emptyList(), emptyList(), 80, "", reasonFrom, source, kind)

    private fun entry(id: Int) =
        Entry("e$id", id, "a$id", null, "", "u", MovieSnapshot("Filme $id", 2000, null, null, null, emptyList()))

    @Test
    fun `esconde da lista, recusadas e as que já estavam na fila`() {
        val items = (1..6).map { rec(it) }
        val shown =
            RecsLines.visible(
                items,
                inList = setOf(1),
                dismissed = setOf(2),
                inQueue = setOf(3, 4),
                queuedHere = setOf(4)
            )
        // A 4 foi posta na fila agora: continua, com "Na fila".
        assertEquals(listOf(4, 5, 6), shown.map { it.tmdbId })
    }

    @Test
    fun `filtra por tipo e só oferece os tipos que existem`() {
        val items = listOf(rec(1, "saga"), rec(2, "diretor"), rec(3, "saga"))
        val noneHidden = RecsLines.visible(items, emptySet(), emptySet(), emptySet(), emptySet(), RecKindFilter.Saga)
        assertEquals(listOf(1, 3), noneHidden.map { it.tmdbId })
        assertEquals(
            listOf(RecKindFilter.All, RecKindFilter.Saga, RecKindFilter.Director),
            RecsLines.filtersFor(items)
        )
    }

    @Test
    fun `selos do tipo`() {
        assertEquals("Saga", RecsLines.kindLabel(rec(1, "saga")))
        assertEquals("Mesmo diretor", RecsLines.kindLabel(rec(1, "diretor")))
        assertEquals("Tema", RecsLines.kindLabel(rec(1, "tema")))
        assertEquals("Em alta", RecsLines.kindLabel(rec(1, "emAlta", "trending")))
        assertEquals("No cinema", RecsLines.kindLabel(rec(1, "emAlta", "nowPlaying")))
        assertNull(RecsLines.kindLabel(rec(1, "outro")))
    }

    @Test
    fun `motivo de reserva não é marcado como gerado`() {
        assertFalse(RecsLines.isGenerated("Mesmo diretor de Alien (Ridley Scott), #3 na lista de vocês"))
        assertFalse(RecsLines.isGenerated("Da saga Alien, como Alien, #3 na lista de vocês"))
        assertFalse(RecsLines.isGenerated("Parecido com Fargo, #2 na lista de vocês (Crime)"))
        assertFalse(RecsLines.isGenerated("Em alta nesta semana e parecido com Fargo, #2 na lista de vocês"))
        assertFalse(RecsLines.isGenerated("Em cartaz no Brasil"))
        assertFalse(RecsLines.isGenerated("Pesa a favor no gosto de vocês: Comédia e anos 90"))
        assertFalse(RecsLines.isGenerated("  "))
        assertTrue(RecsLines.isGenerated("Vocês chamaram Fargo de humor seco; este tem o mesmo tom"))
    }

    @Test
    fun `por causa de, com a posição`() {
        val ranking = listOf(entry(10), entry(20), entry(30))
        val origins = RecsLines.origins(listOf("e30", "x", "e30", "10"), ranking)
        assertEquals(listOf("e30", "e10"), origins.map { it.entryId })
        assertEquals(listOf(3, 1), origins.map { it.position })
        assertEquals("Filme 30", origins.first().title)
    }

    @Test
    fun `quando foi atualizado, no fuso de Brasília`() {
        val now = Instant.parse("2026-10-18T15:00:00Z")
        assertEquals(
            "Atualizadas hoje às 05:02",
            RecsLines.updatedLabel(Instant.parse("2026-10-18T08:02:00Z"), now)
        )
        // 02:30 UTC do dia 18 ainda é dia 17 em Brasília.
        assertEquals(
            "Atualizadas ontem às 23:30",
            RecsLines.updatedLabel(Instant.parse("2026-10-18T02:30:00Z"), now)
        )
        assertEquals(
            "Atualizadas em 12/10 às 05:00",
            RecsLines.updatedLabel(Instant.parse("2026-10-12T08:00:00Z"), now)
        )
    }

    @Test
    fun `linha de ano, duração e gêneros`() {
        assertEquals("1986 · 137 min · Ação, Terror", RecsLines.meta(1986, 137, listOf("Ação", "Terror", "Drama")))
        assertEquals("1986", RecsLines.meta(1986, 0, emptyList()))
        assertEquals("", RecsLines.meta(null, null, emptyList()))
    }
}
