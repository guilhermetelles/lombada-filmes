package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.RecItem
import java.time.Instant
import java.time.format.DateTimeFormatter

/**
 * Filtro por tipo da aba Sugestões.
 *
 * @property label Rótulo do chip.
 * @property kind Valor de `RecItem.kind`; null é "Tudo".
 */
enum class RecKindFilter(val label: String, val kind: String?) {
    All("Tudo", null),
    Saga("Continuar sagas", "saga"),
    Director("Mesmo diretor", "diretor"),
    Theme("Temas parecidos", "tema")
}

/**
 * Filme da lista que justifica uma sugestão ("por causa de").
 *
 * @property entryId Entrada.
 * @property tmdbId Filme.
 * @property title Título.
 * @property position Posição no ranking.
 */
data class RecOrigin(val entryId: String, val tmdbId: Int, val title: String, val position: Int)

/** Regras e textos da aba Sugestões, sem Android. */
object RecsLines {
    /** Abaixo disso, a lista é pequena e a tela avisa que as sugestões ainda acertam pouco. */
    const val SMALL_LIST = 5

    // Começos das frases de reserva do backend (lib/recs/fallback-reason.ts e
    // lib/discover/score-candidates.ts); o resto dos motivos é do Gemini.
    private val fallbackStarts =
        listOf(
            "Em alta nesta semana",
            "Em cartaz no Brasil",
            "Da saga ",
            "Mesmo diretor de ",
            "Parecido com ",
            "Pesa a favor no gosto de vocês",
            "Pouco em comum com o que vocês põem no topo"
        )

    private val hourFormat = DateTimeFormatter.ofPattern("HH:mm")
    private val dayFormat = DateTimeFormatter.ofPattern("dd/MM")

    /**
     * Sugestões que a tela mostra: sem as que já estão na lista, as recusadas ("Não quero") e as
     * que já estavam na fila. As postas na fila nesta visita continuam, com "Na fila".
     *
     * @param items Sugestões, na ordem do backend.
     * @param inList Filmes que já são entradas.
     * @param dismissed Filmes recusados.
     * @param inQueue Filmes na fila.
     * @param queuedHere Filmes postos na fila nesta visita.
     * @param filter Filtro por tipo.
     * @return As sugestões visíveis.
     */
    fun visible(
        items: List<RecItem>,
        inList: Set<Int>,
        dismissed: Set<Int>,
        inQueue: Set<Int>,
        queuedHere: Set<Int>,
        filter: RecKindFilter = RecKindFilter.All
    ): List<RecItem> = items.filter { item ->
        item.tmdbId !in inList &&
            item.tmdbId !in dismissed &&
            (item.tmdbId !in inQueue || item.tmdbId in queuedHere) &&
            (filter.kind == null || item.kind == filter.kind)
    }

    /**
     * Filtros por tipo que têm alguma sugestão; "Tudo" sempre entra.
     *
     * @param items Sugestões já sem as escondidas.
     * @return Os filtros, na ordem da tela.
     */
    fun filtersFor(items: List<RecItem>): List<RecKindFilter> = RecKindFilter.entries.filter { filter ->
        filter.kind == null || items.any { it.kind == filter.kind }
    }

    /**
     * Selo do tipo da sugestão.
     *
     * @param item Sugestão.
     * @return "Saga", "Mesmo diretor", "Tema", "Em alta" ou "No cinema"; null para tipo desconhecido.
     */
    fun kindLabel(item: RecItem): String? = when {
        item.source == "nowPlaying" -> "No cinema"
        item.kind == "emAlta" || item.source == "trending" -> "Em alta"
        item.kind == "saga" -> "Saga"
        item.kind == "diretor" -> "Mesmo diretor"
        item.kind == "tema" -> "Tema"
        else -> null
    }

    /**
     * Se o motivo foi escrito pelo Gemini. O documento não marca a origem; as frases de reserva
     * do backend começam sempre do mesmo jeito, e o resto é do Gemini.
     *
     * @param reason Motivo da sugestão.
     * @return true para o motivo gerado; false para a reserva ou motivo vazio.
     */
    fun isGenerated(reason: String): Boolean {
        val text = reason.trim()
        return text.isNotEmpty() && fallbackStarts.none { text.startsWith(it, ignoreCase = true) }
    }

    /**
     * Filmes da lista que justificam a sugestão, na ordem de `reasonFrom`. Cada id é de uma
     * entrada; um número que não é entrada é tentado como id TMDb de um filme da lista.
     *
     * @param reasonFrom Ids de `RecItem.reasonFrom`.
     * @param ranking Entradas na ordem do ranking.
     * @return Os filmes encontrados, sem repetir.
     */
    fun origins(reasonFrom: List<String>, ranking: List<Entry>): List<RecOrigin> {
        val byId = ranking.withIndex().associateBy { it.value.id }
        val byTmdbId = ranking.withIndex().associateBy { it.value.tmdbId }
        return reasonFrom
            .mapNotNull { id -> byId[id] ?: id.toIntOrNull()?.let(byTmdbId::get) }
            .distinctBy { it.value.id }
            .map { (index, entry) -> RecOrigin(entry.id, entry.tmdbId, entry.movie.title, index + 1) }
    }

    /**
     * Quando a rotina calculou as sugestões, no fuso de Brasília.
     *
     * @param computedAt Instante do cálculo.
     * @param now Agora.
     * @return "Atualizadas hoje às 05:02", "Atualizadas ontem às 05:02" ou "Atualizadas em 12/10 às 05:02".
     */
    fun updatedLabel(computedAt: Instant, now: Instant): String {
        val at = computedAt.atZone(BrazilDay.ZONE)
        val day = at.toLocalDate()
        val today = BrazilDay.of(now)
        val hour = at.format(hourFormat)
        return when (day) {
            today -> "Atualizadas hoje às $hour"
            today.minusDays(1) -> "Atualizadas ontem às $hour"
            else -> "Atualizadas em ${at.format(dayFormat)} às $hour"
        }
    }

    /**
     * Linha com ano, duração e gêneros.
     *
     * @param year Ano.
     * @param runtime Duração em minutos.
     * @param genres Gêneros.
     * @return A linha, como "1986 · 137 min · Ação, Terror".
     */
    fun meta(year: Int?, runtime: Int?, genres: List<String>): String = listOfNotNull(
        year?.toString(),
        runtime?.takeIf { it > 0 }?.let { "$it min" },
        genres.take(2).joinToString(", ").ifEmpty { null }
    ).joinToString(" · ")
}
