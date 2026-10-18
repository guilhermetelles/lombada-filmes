package io.github.guilhermetelles.lombada.data.model

import java.time.LocalDate

/**
 * Consumo de uma fonte num dia.
 *
 * @property calls Pedidos feitos.
 * @property errors Pedidos que falharam.
 * @property cacheHits Respostas vindas do cache.
 * @property dailyLimit Cota diária, quando a fonte tem uma (OMDb).
 */
data class SourceUsage(val calls: Int, val errors: Int, val cacheHits: Int, val dailyLimit: Int?)

/**
 * Documento `usage/{yyyy-mm-dd}`, escrito pelo backend.
 *
 * @property day Dia, no fuso de São Paulo.
 * @property sources Consumo por fonte (`tmdb`, `omdb`, `letterboxd`, `bechdel`, `wikidata`, `wikipedia`, `gemini`).
 */
data class UsageDay(val day: LocalDate, val sources: Map<String, SourceUsage>) {
    /** Pedidos do dia, somando as fontes. */
    val totalCalls: Int get() = sources.values.sumOf { it.calls }
}
