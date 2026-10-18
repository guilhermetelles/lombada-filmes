package io.github.guilhermetelles.lombada.domain

import kotlin.math.floor

/**
 * Corte das faixas da tier list: a parte da lista que cabe em cada faixa.
 *
 * @property id Identificador estável, para lembrar a escolha.
 * @property label Nome mostrado no chip.
 * @property shares Porcentagem de cada faixa, de S a F; soma 100.
 */
data class TierPreset(val id: String, val label: String, val shares: List<Int>)

/**
 * Uma faixa da tier list.
 *
 * @param T Tipo dos itens (as entradas da lista).
 * @property id Letra da faixa, minúscula: `s`, `a`, `b`, `c` ou `f`.
 * @property share Porcentagem da lista que o corte dá a esta faixa.
 * @property from Primeira posição no ranking (a partir de 1); maior que [to] quando a faixa está vazia.
 * @property to Última posição no ranking.
 * @property items Itens da faixa, na ordem do ranking.
 */
data class TierBand<T>(val id: String, val share: Int, val from: Int, val to: Int, val items: List<T>) {
    /** Letra maiúscula, como aparece na tela. */
    val letter: String get() = id.uppercase()
}

/**
 * Tier list: o mesmo ranking em faixas S, A, B, C e F, pela posição, como no mock. Cada faixa
 * termina na posição arredondada da soma das porcentagens até ela; a última vai até o fim.
 */
object Tiers {
    /** Letras das faixas, da melhor para a pior. */
    val IDS = listOf("s", "a", "b", "c", "f")

    /** Os três cortes do mock; o primeiro é o padrão. */
    val PRESETS =
        listOf(
            TierPreset("equilibrada", "Equilibrada", listOf(10, 20, 30, 25, 15)),
            TierPreset("exigente", "Exigente", listOf(5, 15, 30, 30, 20)),
            TierPreset("generosa", "Generosa", listOf(20, 30, 25, 15, 10))
        )

    /**
     * Acha um corte pelo id.
     *
     * @param id Id salvo.
     * @return O corte, ou o padrão (Equilibrada) quando o id não existe.
     */
    fun preset(id: String?): TierPreset = PRESETS.firstOrNull { it.id == id } ?: PRESETS.first()

    /**
     * Divide a lista em faixas. Toda a lista entra, sem repetir, na ordem do ranking.
     *
     * @param ranking Itens na ordem do ranking.
     * @param preset Corte escolhido.
     * @return Uma faixa por letra, de S a F (as vazias também).
     */
    fun <T> bands(ranking: List<T>, preset: TierPreset): List<TierBand<T>> {
        var start = 0
        var accumulated = 0
        return IDS.mapIndexed { index, id ->
            accumulated += preset.shares[index]
            // Soma em pontos percentuais inteiros, para 0,1 + 0,2 não virar 0,30000000000000004.
            val end =
                if (index == IDS.lastIndex) {
                    ranking.size
                } else {
                    jsRound(accumulated * ranking.size / 100.0).coerceIn(start, ranking.size)
                }
            val band = TierBand(id, preset.shares[index], start + 1, end, ranking.subList(start, end).toList())
            start = end
            band
        }
    }

    /**
     * Resumo do corte, como "S 10% · A 20% · B 30% · C 25% · F 15%".
     *
     * @param preset Corte.
     * @return Texto.
     */
    fun cutLabel(preset: TierPreset): String =
        IDS.mapIndexed { index, id -> "${id.uppercase()} ${preset.shares[index]}%" }.joinToString(" · ")

    // Math.round do JavaScript: .5 sobe.
    private fun jsRound(value: Double): Int = floor(value + 0.5).toInt()
}
