package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Movie
import io.github.guilhermetelles.lombada.data.model.MovieCollection
import io.github.guilhermetelles.lombada.data.model.ProvidersBR
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CuriositiesTest {
    private fun movie(
        title: String = "The Abyss",
        titlePt: String? = null,
        tagline: String? = null,
        budget: Long? = null,
        revenue: Long? = null,
        boxOfficeUS: Long? = null,
        certBR: String? = null,
        collection: MovieCollection? = null,
        providers: List<String>? = null
    ) = Movie(
        tmdbId = 2756,
        title = title,
        year = 1989,
        directors = emptyList(),
        cast = emptyList(),
        runtime = 140,
        genres = emptyList(),
        synopsisPt = null,
        synopsisEn = null,
        posterPath = null,
        imdbId = null,
        letterboxdUrl = null,
        letterboxd = null,
        imdb = null,
        rottenTomatoes = null,
        metacritic = null,
        tmdbFetchedAt = null,
        titlePt = titlePt,
        tagline = tagline,
        budget = budget,
        revenue = revenue,
        boxOfficeUS = boxOfficeUS,
        certBR = certBR,
        collection = collection,
        providersBR = providers?.let { ProvidersBR(it, emptyList(), null) }
    )

    @Test
    fun `filme sem campos extras não tem curiosidades`() {
        assertTrue(Curiosities.of(movie()).isEmpty)
    }

    @Test
    fun `título no Brasil não vira curiosidade, porque já está no topo da página`() {
        assertTrue(Curiosities.of(movie(titlePt = "O Segredo do Abismo")).isEmpty)
    }

    @Test
    fun `orçamento contra bilheteria diz quantas vezes ou que não se pagou`() {
        val paid = Curiosities.of(movie(budget = 70_000_000, revenue = 90_000_000)).rows.single()
        assertEquals("Dinheiro", paid.label)
        assertEquals("Custou US$ 70 milhões e faturou US$ 90 milhões no mundo, 1,3 vez o orçamento.", paid.plain)

        val big = Curiosities.of(movie(budget = 100_000_000, revenue = 1_500_000_000)).rows.single()
        assertEquals(
            "Custou US$ 100 milhões e faturou US$ 1,5 bilhão no mundo, 15,0 vezes o orçamento.",
            big.plain
        )

        val flop = Curiosities.of(movie(budget = 80_000_000, revenue = 36_000_000)).rows.single()
        assertEquals(
            "Custou US$ 80 milhões e faturou US$ 36 milhões no mundo: não se pagou nas bilheterias (45% do orçamento).",
            flop.plain
        )
    }

    @Test
    fun `só orçamento ou só bilheteria`() {
        assertEquals("Orçamento", Curiosities.of(movie(budget = 800_000)).rows.single().label)
        assertEquals("US$ 800 mil", Curiosities.of(movie(budget = 800_000)).rows.single().plain)
        assertEquals("Bilheteria mundial", Curiosities.of(movie(revenue = 2_500_000_000)).rows.single().label)
        assertEquals("US$ 2,5 bilhões", Curiosities.of(movie(revenue = 2_500_000_000)).rows.single().plain)
    }

    @Test
    fun `bilheteria nos EUA com a parte do total`() {
        val rows = Curiosities.of(movie(revenue = 90_000_000, boxOfficeUS = 54_000_000)).rows
        assertEquals("Bilheteria de US$ 54 milhões, 60% do total.", rows.first { it.label == "Nos EUA" }.plain)
        val alone = Curiosities.of(movie(boxOfficeUS = 54_000_000)).rows.single()
        assertEquals("Bilheteria de US$ 54 milhões.", alone.plain)
    }

    @Test
    fun `classificação, saga, slogan e onde assistir`() {
        val curiosities =
            Curiosities.of(
                movie(
                    tagline = "“There's everything you've ever known about adventure...”",
                    certBR = "14",
                    collection = MovieCollection(1, "Coleção Abismo"),
                    providers = listOf("Netflix", "Max")
                )
            )
        assertEquals("There's everything you've ever known about adventure...", curiosities.tagline)
        assertEquals(listOf("Classificação", "Saga"), curiosities.rows.map { it.label })
        assertEquals("14 anos", curiosities.rows[0].plain)
        assertEquals("Coleção Abismo", curiosities.rows[1].plain)
        assertEquals(listOf("Netflix", "Max"), curiosities.providers)
        assertEquals("Livre para todos os públicos", Curiosities.certificationText("L"))
        assertEquals("ER", Curiosities.certificationText("ER"))
    }

    @Test
    fun `slogan vazio vira null`() {
        assertNull(Curiosities.of(movie(tagline = "  ")).tagline)
    }
}
