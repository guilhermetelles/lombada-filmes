package io.github.guilhermetelles.lombada.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TiersTest {
    private fun sizes(count: Int, presetId: String) =
        Tiers.bands((1..count).toList(), Tiers.preset(presetId)).map { it.items.size }

    @Test
    fun `as faixas cobrem a lista inteira, sem sobrar nem repetir, em todos os cortes`() {
        listOf(0, 1, 2, 3, 7, 10, 92, 101).forEach { count ->
            val ranking = (1..count).toList()
            Tiers.PRESETS.forEach { preset ->
                val bands = Tiers.bands(ranking, preset)
                assertEquals(Tiers.IDS, bands.map { it.id })
                assertEquals("$count filmes, ${preset.id}", ranking, bands.flatMap { it.items })
                bands.forEach { band ->
                    assertEquals((band.from..band.to).toList(), band.items)
                }
            }
        }
    }

    @Test
    fun `cada corte soma 100 por cento`() {
        Tiers.PRESETS.forEach { assertEquals(100, it.shares.sum()) }
    }

    @Test
    fun `um filme cai na faixa B no corte equilibrado`() {
        assertEquals(listOf(0, 0, 1, 0, 0), sizes(1, "equilibrada"))
        val band = Tiers.bands(listOf("x"), Tiers.preset("equilibrada"))[2]
        assertEquals(1, band.from)
        assertEquals(1, band.to)
    }

    @Test
    fun `dois filmes arredondam como no mock`() {
        assertEquals(listOf(0, 1, 0, 1, 0), sizes(2, "equilibrada"))
        assertEquals(listOf(0, 0, 1, 1, 0), sizes(2, "exigente"))
        assertEquals(listOf(0, 1, 1, 0, 0), sizes(2, "generosa"))
    }

    @Test
    fun `92 filmes nos tres cortes`() {
        assertEquals(listOf(9, 19, 27, 23, 14), sizes(92, "equilibrada"))
        assertEquals(listOf(5, 13, 28, 28, 18), sizes(92, "exigente"))
        assertEquals(listOf(18, 28, 23, 14, 9), sizes(92, "generosa"))
    }

    @Test
    fun `faixa vazia tem o inicio depois do fim`() {
        val empty = Tiers.bands(listOf(1), Tiers.preset("equilibrada")).first()
        assertTrue(empty.items.isEmpty())
        assertTrue(empty.from > empty.to)
    }

    @Test
    fun `id desconhecido usa o corte equilibrado`() {
        assertEquals("equilibrada", Tiers.preset("outro").id)
        assertEquals("equilibrada", Tiers.preset(null).id)
    }

    @Test
    fun `resumo do corte`() {
        assertEquals("S 5% · A 15% · B 30% · C 30% · F 20%", Tiers.cutLabel(Tiers.preset("exigente")))
    }
}
