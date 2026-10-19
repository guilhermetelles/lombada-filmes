package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.MovieRecInfo
import io.github.guilhermetelles.lombada.data.model.MovieSnapshot
import io.github.guilhermetelles.lombada.data.model.RecItem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test

class MovieTitlesTest {
    private val pt = TitleLanguage.Portuguese
    private val en = TitleLanguage.English

    private fun entry(id: String, tmdbId: Int, title: String) =
        Entry(id, tmdbId, "a0", null, "", "u", MovieSnapshot(title, 1989, null, null, null, emptyList()))

    @Test
    fun `escolhe o idioma e cai no outro quando falta`() {
        assertEquals("O Segredo do Abismo", MovieTitles.pick("The Abyss", "O Segredo do Abismo", pt))
        assertEquals("The Abyss", MovieTitles.pick("The Abyss", "O Segredo do Abismo", en))
        assertEquals("The Abyss", MovieTitles.pick("The Abyss", null, pt))
        assertEquals("The Abyss", MovieTitles.pick("The Abyss", "  ", pt))
        assertEquals("O Segredo do Abismo", MovieTitles.pick(null, "O Segredo do Abismo", en))
    }

    @Test
    fun `outro título só quando existe e é diferente`() {
        assertEquals("The Abyss", MovieTitles.other("The Abyss", "O Segredo do Abismo", pt))
        assertEquals("O Segredo do Abismo", MovieTitles.other("The Abyss", "O Segredo do Abismo", en))
        assertNull(MovieTitles.other("Alien", "alien", pt))
        assertNull(MovieTitles.other("The Abyss", null, pt))
        assertNull(MovieTitles.other("The Abyss", null, en))
    }

    @Test
    fun `sugestões e parecidos têm o português em title e o inglês em titleEn`() {
        val rec =
            RecItem(
                tmdbId = 1,
                title = "O Segredo do Abismo",
                year = null,
                posterPath = null,
                runtime = null,
                genres = emptyList(),
                providers = emptyList(),
                score = 80,
                reason = "",
                reasonFrom = emptyList(),
                source = "model",
                kind = "tema",
                titleEn = "The Abyss"
            )
        assertEquals("The Abyss", MovieTitles.of(rec, en))
        assertEquals("O Segredo do Abismo", MovieTitles.of(rec, pt))
        // Documento antigo, sem titleEn: fica o que houver.
        assertEquals("O Segredo do Abismo", MovieTitles.of(rec.copy(titleEn = null), en))
        val info = MovieRecInfo(1, "O Segredo do Abismo", null, null, "The Abyss")
        assertEquals("The Abyss", MovieTitles.of(info, en))
    }

    @Test
    fun `entradas trocam para o português e guardam o inglês em titleAlt`() {
        val ranking = listOf(entry("e1", 1, "The Abyss"), entry("e2", 2, "Alien"))
        val localized = MovieTitles.localize(ranking, mapOf(1 to "O Segredo do Abismo", 2 to "Alien"), pt)
        assertEquals("O Segredo do Abismo", localized[0].movie.title)
        assertEquals("The Abyss", localized[0].movie.titleAlt)
        assertSame(ranking[1], localized[1])
        assertSame(ranking, MovieTitles.localize(ranking, mapOf(1 to "O Segredo do Abismo"), en))
    }

    @Test
    fun `valor guardado desconhecido volta ao padrão`() {
        assertEquals(TitleLanguage.English, TitleLanguage.fromKey("en"))
        assertEquals(TitleLanguage.Portuguese, TitleLanguage.fromKey(null))
        assertEquals(TitleLanguage.Portuguese, TitleLanguage.fromKey("fr"))
        assertEquals("en", TitleLanguage.English.apiParam)
        assertNull(TitleLanguage.Portuguese.apiParam)
    }
}
