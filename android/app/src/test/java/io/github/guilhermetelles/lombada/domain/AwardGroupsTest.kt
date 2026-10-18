package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.AwardItem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AwardGroupsTest {
    private fun win(org: String, cat: String? = null, year: Int? = null) = AwardItem(org, cat, AwardItem.KIND_WIN, year)

    private fun nom(org: String, cat: String? = null, year: Int? = null) =
        AwardItem(org, cat, AwardItem.KIND_NOMINATION, year)

    @Test
    fun `agrupa por premiação na ordem do mock, com vitórias antes e ano faltando no fim`() {
        val groups =
            AwardGroups.of(
                listOf(
                    nom("Framboesa de Ouro", "pior filme", 2013),
                    nom("Oscar", "melhor som", null),
                    win("Saturn", "melhor filme de fantasia", 2013),
                    nom("Oscar", "melhor direção", 1990),
                    win("Oscar", "melhores efeitos visuais", 1990),
                    win("Prêmio Qualquer", null, null)
                )
            )
        assertEquals(listOf("Oscar", "Saturn", "Framboesa de Ouro", "Prêmio Qualquer"), groups.map { it.org })
        val oscar = groups.first()
        assertEquals(
            listOf("melhores efeitos visuais", "melhor direção", "melhor som"),
            oscar.items.map {
                it.category
            }
        )
        assertEquals(1, oscar.wins)
        assertEquals(2, oscar.nominations)
        assertEquals("1 vitória, 2 indicações", oscar.tally)
    }

    @Test
    fun `no filme a Framboesa vem primeiro e ganha a frase de destaque`() {
        val won = AwardGroups.forMovie(
            listOf(win("Oscar", "melhor som", 2000), win("Framboesa de Ouro", "pior filme", 2013))
        )
        assertEquals("Framboesa de Ouro", won.first().org)
        assertEquals("Levou a Framboesa de Ouro, o prêmio de pior do ano.", AwardGroups.razzieNote(won))

        val nominated = AwardGroups.forMovie(listOf(nom("Framboesa de Ouro", null, null)))
        assertEquals("Concorreu à Framboesa de Ouro, o prêmio de pior do ano.", AwardGroups.razzieNote(nominated))

        assertNull(AwardGroups.razzieNote(AwardGroups.forMovie(listOf(win("Oscar")))))
    }

    @Test
    fun `sem prêmios não há grupos`() {
        assertTrue(AwardGroups.of(emptyList()).isEmpty())
    }

    @Test
    fun `resumo da pessoa conta vitórias fora a Framboesa`() {
        val groups =
            AwardGroups.of(
                listOf(
                    win("Oscar", "melhor ator", 2000),
                    nom("Oscar", "melhor ator", 1995),
                    nom("Oscar", "melhor ator", 2005),
                    win("Globo de Ouro", "melhor ator", 2000),
                    win("Framboesa de Ouro", "pior ator", 2010)
                )
            )
        assertEquals(
            "2 vitórias nas premiações que o app acompanha, com 1 Oscar e 2 indicações na Academia e 1 Framboesa de Ouro.",
            AwardGroups.personSummary(groups)
        )
    }

    @Test
    fun `resumo da pessoa sem Oscar nem Framboesa`() {
        assertEquals(
            "1 vitória nas premiações que o app acompanha.",
            AwardGroups.personSummary(AwardGroups.of(listOf(win("BAFTA", "melhor direção", 2001))))
        )
        assertEquals(
            "0 vitórias nas premiações que o app acompanha, com nenhum Oscar e 1 indicação na Academia e " +
                "2 indicações à Framboesa de Ouro.",
            AwardGroups.personSummary(
                AwardGroups.of(listOf(nom("Oscar"), nom("Framboesa de Ouro", "a", 1), nom("Framboesa de Ouro", "b", 2)))
            )
        )
    }
}
