package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.DiscoverItem
import io.github.guilhermetelles.lombada.data.model.Filters
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DiscoverFiltersTest {
    private fun option(group: FilterGroup, id: String) = DiscoverFilters.options(group).first { it.id == id }

    @Test
    fun `liga e desliga um valor e o fit`() {
        val comedy = option(FilterGroup.Genre, "Comédia")
        val on = DiscoverFilters.toggle(Filters(), comedy)
        assertEquals(listOf("Comédia"), on.genre)
        assertEquals(Filters(), DiscoverFilters.toggle(on, comedy))
        val fit = DiscoverFilters.toggle(Filters(), FilterOption(null, "fit", DiscoverFilters.FIT_LABEL))
        assertTrue(fit.fit)
        assertFalse(DiscoverFilters.toggle(fit, FilterOption(null, "fit", DiscoverFilters.FIT_LABEL)).fit)
    }

    @Test
    fun `os valores são os do contrato`() {
        assertEquals(
            listOf("leve", "tenso", "ruim-divertido", "chorar", "cult"),
            DiscoverFilters.options(FilterGroup.Mood).map { it.id }
        )
        assertEquals(listOf("ate90", "90a120", "mais120"), DiscoverFilters.options(FilterGroup.Dur).map { it.id })
        assertEquals(
            listOf("antes70", "1970", "1980", "1990", "2000", "2010", "2020"),
            DiscoverFilters.options(FilterGroup.Dec).map { it.id }
        )
        assertEquals(
            listOf(
                "lgbt",
                "fatos",
                "trash",
                "tempo",
                "golpes",
                "espaco",
                "zumbis-vampiros",
                "halloween",
                "serial-killer",
                "livro"
            ),
            DiscoverFilters.options(FilterGroup.Theme).map { it.id }
        )
        assertFalse(DiscoverFilters.options(FilterGroup.Genre).any { it.id == "Cinema TV" })
    }

    @Test
    fun `limpa o que a tela não conhece e os repetidos`() {
        val raw =
            Filters(
                mood = listOf("leve", "estranho", "leve"),
                genre = listOf("Comédia", "Novela"),
                svc = listOf("Netflix", "Netflix", "Locadora"),
                fit = true
            )
        assertEquals(
            Filters(mood = listOf("leve"), genre = listOf("Comédia"), svc = listOf("Netflix"), fit = true),
            DiscoverFilters.clean(raw)
        )
    }

    @Test
    fun `chips do que foi entendido, com rótulos e o fit por último`() {
        val filters = Filters(theme = listOf("lgbt"), genre = listOf("Comédia"), dur = listOf("ate90"), fit = true)
        assertEquals(
            listOf("Até 90 min", "Comédia", "LGBT+", DiscoverFilters.FIT_LABEL),
            DiscoverFilters.active(filters).map { it.label }
        )
        assertEquals("com 4 filtros", DiscoverFilters.filtersLabel(filters))
        assertEquals("com 1 filtro", DiscoverFilters.filtersLabel(Filters(dec = listOf("1990"))))
        assertEquals("sem filtros", DiscoverFilters.filtersLabel(Filters()))
    }

    @Test
    fun `página nova entra ordenada, sem repetir e sem mexer nas anteriores`() {
        fun item(id: Int, score: Double) = DiscoverItem(tmdbId = id, title = "Filme $id", score = score)
        val first = DiscoverResults.append(emptyList(), listOf(item(1, 50.0), item(2, 90.0)))
        assertEquals(listOf(2, 1), first.map { it.tmdbId })
        val second = DiscoverResults.append(first, listOf(item(3, 40.0), item(1, 99.0), item(4, 95.0)))
        assertEquals(listOf(2, 1, 4, 3), second.map { it.tmdbId })
    }

    @Test
    fun `página com palavras-chave entra com as que têm mais palavras primeiro`() {
        fun item(id: Int, score: Double, matched: List<Int>) =
            DiscoverItem(tmdbId = id, title = "Filme $id", score = score, matchedKeywords = matched)
        val page = listOf(item(1, 90.0, emptyList()), item(2, 40.0, listOf(7, 8)), item(3, 80.0, listOf(7)))
        assertEquals(listOf(2, 3, 1), DiscoverResults.append(emptyList(), page).map { it.tmdbId })
    }

    @Test
    fun `filtros do texto somam aos ligados, sem repetir, e o fit fica se qualquer um tiver`() {
        val manual = Filters(genre = listOf("Comédia"), dec = listOf("1990"), fit = true)
        val understood = Filters(genre = listOf("Terror", "Comédia"), svc = listOf("Netflix"), fit = false)
        assertEquals(
            Filters(
                genre = listOf("Comédia", "Terror"),
                dec = listOf("1990"),
                svc = listOf("Netflix"),
                fit = true
            ),
            DiscoverFilters.union(manual, understood)
        )
        assertTrue(DiscoverFilters.union(Filters(), Filters(fit = true)).fit)
        assertEquals(manual, DiscoverFilters.union(manual, Filters()))
    }

    @Test
    fun `palavras-chave contam como filtros`() {
        assertEquals("com 3 filtros", DiscoverFilters.filtersLabel(Filters(dec = listOf("1990")), keywordCount = 2))
        assertEquals("com 1 filtro", DiscoverFilters.filtersLabel(Filters(), keywordCount = 1))
    }

    @Test
    fun `posição na lista dos que já são entradas`() {
        val positions = mapOf("e7" to 3)
        assertEquals(
            3,
            DiscoverResults.position(DiscoverItem(tmdbId = 1, title = "A", inListEntryId = "e7"), positions)
        )
        assertNull(DiscoverResults.position(DiscoverItem(tmdbId = 1, title = "A"), positions))
        assertNull(DiscoverResults.position(DiscoverItem(tmdbId = 1, title = "A", inListEntryId = "e9"), positions))
    }
}
