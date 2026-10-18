package io.github.guilhermetelles.lombada.domain

import java.util.Locale
import kotlin.math.roundToLong

/** Pedaços de texto em português usados pelas seções novas do filme e da fila. */
object PortugueseText {
    /**
     * Junta itens com vírgulas e "e" antes do último.
     *
     * @param parts Itens.
     * @return "A", "A e B" ou "A, B e C"; vazio sem itens.
     */
    fun join(parts: List<String>): String = when (parts.size) {
        0 -> ""
        1 -> parts.first()
        else -> parts.dropLast(1).joinToString(", ") + " e " + parts.last()
    }

    /**
     * Valor em dólares por extenso curto, como no mock.
     *
     * @param dollars Valor em US$ (positivo).
     * @return "US$ 1,2 bilhão", "US$ 2,5 bilhões", "US$ 63 milhões" ou "US$ 800 mil".
     */
    fun money(dollars: Long): String = when {
        dollars >= 1_000_000_000 -> {
            val billions = dollars / 1e9
            val text = String.format(Locale.ROOT, "%.1f", billions).replace('.', ',')
            "US$ $text ${if (billions < 2) "bilhão" else "bilhões"}"
        }

        dollars >= 1_000_000 -> "US$ ${(dollars / 1e6).roundToLong()} milhões"

        else -> "US$ ${(dollars / 1e3).roundToLong()} mil"
    }

    /**
     * Número com uma casa e vírgula.
     *
     * @param value Número.
     * @return Ex.: "4,2".
     */
    fun oneDecimal(value: Double): String = String.format(Locale.ROOT, "%.1f", value).replace('.', ',')
}
