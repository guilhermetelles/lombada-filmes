package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.AwardItem

/**
 * Prêmios de uma premiação, para a seção "Prêmios e indicações".
 *
 * @property org Premiação.
 * @property items Vitórias antes das indicações; dentro delas, por ano (sem ano por último).
 * @property wins Quantas vitórias.
 * @property nominations Quantas indicações (sem contar as vitórias).
 */
data class AwardGroup(val org: String, val items: List<AwardItem>, val wins: Int, val nominations: Int) {
    /** Se é a Framboesa de Ouro, o prêmio de pior do ano. */
    val isRazzie: Boolean get() = org == AwardGroups.RAZZIE

    /** "2 vitórias, 1 indicação", só com o que houver. */
    val tally: String
        get() =
            listOfNotNull(
                wins.takeIf { it > 0 }?.let { Formatting.count(it, "vitória", "vitórias") },
                nominations.takeIf { it > 0 }?.let { Formatting.count(it, "indicação", "indicações") }
            ).joinToString(", ")
}

/**
 * Agrupa os prêmios por premiação. Os itens já chegam juntos e sem repetidos do backend
 * (`mergeAwards`); aqui só se agrupa, ordena e resume.
 */
object AwardGroups {
    /** Nome da Framboesa de Ouro em `awards.items[].org`. */
    const val RAZZIE = "Framboesa de Ouro"

    /** Fonte mostrada embaixo das seções de prêmios. */
    const val SOURCE = "Fontes: Wikidata, Wikipedia e OMDb. As bases nem sempre trazem o ano ou a categoria."

    // Ordem das premiações; as outras vêm depois, em ordem alfabética.
    private val ORDER = listOf("Oscar", "Globo de Ouro", "BAFTA", "Cannes", "Saturn", "Grand Bell", RAZZIE)

    /**
     * Agrupa por premiação, na ordem do mock (Oscar primeiro, Framboesa por último).
     *
     * @param items Prêmios e indicações.
     * @return Os grupos; vazio sem prêmios.
     */
    fun of(items: List<AwardItem>): List<AwardGroup> = items
        .groupBy { it.org }
        .map { (org, awards) ->
            val sorted = awards.sortedWith(compareBy<AwardItem> { if (it.isWin) 0 else 1 }.thenBy { it.year ?: 9_999 })
            AwardGroup(org, sorted, wins = awards.count { it.isWin }, nominations = awards.count { !it.isWin })
        }.sortedWith(compareBy<AwardGroup> { orderOf(it.org) }.thenBy { it.org })

    /**
     * Grupos na ordem da página do filme: a Framboesa em destaque, antes das outras.
     *
     * @param items Prêmios e indicações do filme.
     * @return Os grupos; vazio sem prêmios.
     */
    fun forMovie(items: List<AwardItem>): List<AwardGroup> = of(items).sortedBy { if (it.isRazzie) 0 else 1 }

    /**
     * Frase de destaque da Framboesa no filme.
     *
     * @param groups Grupos do filme.
     * @return "Levou…" ou "Concorreu…"; null quando o filme não concorreu.
     */
    fun razzieNote(groups: List<AwardGroup>): String? {
        val razzie = groups.firstOrNull { it.isRazzie } ?: return null
        return if (razzie.wins > 0) {
            "Levou a Framboesa de Ouro, o prêmio de pior do ano."
        } else {
            "Concorreu à Framboesa de Ouro, o prêmio de pior do ano."
        }
    }

    /**
     * Resumo dos prêmios de uma pessoa: vitórias fora a Framboesa, com o Oscar e a Framboesa à parte.
     *
     * @param groups Grupos da pessoa (não vazio).
     * @return Ex.: "3 vitórias nas premiações que o app acompanha, com 1 Oscar e 2 indicações na Academia."
     */
    fun personSummary(groups: List<AwardGroup>): String {
        val wins = groups.filterNot { it.isRazzie }.sumOf { it.wins }
        val oscar = groups.firstOrNull { it.org == "Oscar" }
        val razzie = groups.firstOrNull { it.isRazzie }
        val lead =
            listOfNotNull(
                oscar?.let {
                    val won =
                        when (it.wins) {
                            0 -> "nenhum Oscar"
                            1 -> "1 Oscar"
                            else -> "${it.wins} Oscars"
                        }
                    val nominated =
                        if (it.nominations >
                            0
                        ) {
                            " e ${Formatting.count(it.nominations, "indicação", "indicações")}"
                        } else {
                            ""
                        }
                    "$won$nominated na Academia"
                },
                razzie?.let {
                    when (it.wins) {
                        0 -> "${Formatting.count(it.nominations, "indicação", "indicações")} à Framboesa de Ouro"
                        1 -> "1 Framboesa de Ouro"
                        else -> "${it.wins} Framboesas de Ouro"
                    }
                }
            )
        val total = "${Formatting.count(wins, "vitória", "vitórias")} nas premiações que o app acompanha"
        return if (lead.isEmpty()) "$total." else "$total, com ${PortugueseText.join(lead)}."
    }

    private fun orderOf(org: String): Int = ORDER.indexOf(org).let { if (it < 0) ORDER.size else it }
}
