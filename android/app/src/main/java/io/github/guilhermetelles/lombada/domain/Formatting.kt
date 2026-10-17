package io.github.guilhermetelles.lombada.domain

import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Formatos de número e data usados nas telas, como no mock. */
object Formatting {
    private val shortDate = DateTimeFormatter.ofPattern("dd/MM/yy")
    private val fullDate = DateTimeFormatter.ofPattern("dd/MM/yyyy")

    /**
     * Uma casa decimal com ponto, como no mock, ou travessão sem valor.
     *
     * @param value Número.
     * @return Por exemplo `7.5` ou `–`.
     */
    fun oneDecimal(value: Double?): String = value?.let { String.format(Locale.ROOT, "%.1f", it) } ?: "–"

    /**
     * Data curta, `dd/mm/aa`.
     *
     * @param date Data.
     * @return Texto formatado.
     */
    fun shortDate(date: LocalDate): String = date.format(shortDate)

    /**
     * Data completa, `dd/mm/aaaa`.
     *
     * @param date Data.
     * @return Texto formatado.
     */
    fun fullDate(date: LocalDate): String = date.format(fullDate)

    /**
     * Linha "Visto em" de uma entrada.
     *
     * @param date Data em que viram, ou null.
     * @return "Visto em 12/10/25" ou "Data não registrada".
     */
    fun seenLine(date: LocalDate?): String = date?.let { "Visto em ${shortDate(it)}" } ?: "Data não registrada"

    /**
     * Quantidade com o nome no singular ou plural.
     *
     * @param count Quantidade.
     * @param one Nome no singular.
     * @param many Nome no plural.
     * @return Por exemplo "1 filme" ou "91 filmes".
     */
    fun count(count: Int, one: String, many: String): String = "$count ${if (count == 1) one else many}"

    /**
     * Título encurtado para mensagens, como no mock.
     *
     * @param title Título do filme.
     * @return Título sem o prefixo de "O Senhor dos Anéis" quando é longo.
     */
    fun shortTitle(title: String): String = if (title.length >
        30
    ) {
        title.removePrefix("The Lord of the Rings: ")
    } else {
        title
    }
}
