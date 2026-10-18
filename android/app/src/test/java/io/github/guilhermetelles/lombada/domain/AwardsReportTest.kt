package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.AwardItem
import io.github.guilhermetelles.lombada.data.model.Awards
import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.Movie
import io.github.guilhermetelles.lombada.data.model.MovieSnapshot
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AwardsReportTest {
    private fun entry(id: Int) =
        Entry("e$id", id, "a$id", null, "", "u", MovieSnapshot("Filme $id", 2000, null, null, null, emptyList()))

    private fun movie(id: Int, items: List<AwardItem>?) = Movie(
        tmdbId = id,
        title = "Filme $id",
        year = 2000,
        directors = emptyList(),
        cast = emptyList(),
        runtime = null,
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
        awards = items?.let { Awards(it, null, null) }
    )

    private fun win(org: String, cat: String? = null, year: Int? = null) = AwardItem(org, cat, AwardItem.KIND_WIN, year)

    private fun nom(org: String, cat: String? = null, year: Int? = null) =
        AwardItem(org, cat, AwardItem.KIND_NOMINATION, year)

    private val razzie = AwardGroups.RAZZIE

    /** Lista na ordem dos ids, com os prêmios de cada filme (null = ainda sem `awards`). */
    private fun report(vararg films: Pair<Int, List<AwardItem>?>): AwardsReport? {
        val ranking = films.map { entry(it.first) }
        val movies = films.associate { (id, items) -> id to movie(id, items) }
        return Reports.awards(ranking, movies)
    }

    @Test
    fun `sem premios buscados o card some`() {
        assertNull(report(1 to null, 2 to emptyList()))
        assertNull(Reports.awards(listOf(entry(1)), emptyMap()))
    }

    @Test
    fun `so indicacoes fora da Framboesa nao bastam para o card`() {
        assertNull(report(1 to listOf(nom("Oscar", "melhor roteiro", 2001)), 2 to null))
    }

    @Test
    fun `conta vitorias, Oscars e Framboesas com categoria e ano faltando`() {
        val result =
            requireNotNull(
                report(
                    // #1: 2 vitórias (1 Oscar sem categoria, 1 BAFTA sem ano) e uma indicação ao Oscar.
                    1 to listOf(win("Oscar"), win("BAFTA", "melhor filme"), nom("Oscar", null, 2000)),
                    // #2: sem awards.
                    2 to null,
                    // #3: indicado ao Oscar e levou 2 Framboesas.
                    3 to listOf(nom("Oscar", "melhor canção"), win(razzie, null, null), win(razzie, "pior ator")),
                    // #4: só indicado à Framboesa.
                    4 to listOf(nom(razzie), nom(razzie, "pior roteiro", 2010)),
                    // #5: 3 Oscars.
                    5 to listOf(win("Oscar", "a"), win("Oscar", "b"), win("Oscar", "c"))
                )
            )
        assertEquals(
            "2 filmes da lista concorreram à Framboesa de Ouro; 1 levou. " +
                "Do outro lado, 2 filmes ganharam pelo menos um Oscar.",
            result.headline
        )
        assertEquals(listOf(5, 1), result.mostAwarded.map { it.position })
        assertEquals(listOf("3 vitórias · 3 Oscars", "2 vitórias · 1 Oscar"), result.mostAwarded.map { it.detail })
        assertEquals(listOf(3, 4), result.razzies.map { it.position })
        assertEquals(listOf("levou 2 Framboesas", "2 indicações à Framboesa"), result.razzies.map { it.detail })
        assertEquals(listOf(3), result.both.map { it.position })
        assertEquals("1 indicação ao Oscar e levou 2 Framboesas", result.both.single().detail)
        // Oscar: #1 e #5, média 3; Framboesa: #3 e #4, média 3,5, que arredonda para 4.
        assertEquals(3, result.oscarAverageRank)
        assertEquals(4, result.razzieAverageRank)
    }

    @Test
    fun `sem Framboesa a frase fala so do Oscar e nao ha medias`() {
        val result = requireNotNull(report(1 to listOf(win("Oscar", "melhor filme", 1998)), 2 to listOf(win("Saturn"))))
        assertEquals(
            "1 filme da lista ganhou pelo menos um Oscar, e nenhum concorreu à Framboesa de Ouro.",
            result.headline
        )
        assertEquals(listOf("1 vitória · 1 Oscar", "1 vitória"), result.mostAwarded.map { it.detail })
        assertEquals(emptyList<AwardsRow>(), result.razzies)
        assertNull(result.oscarAverageRank)
        assertNull(result.razzieAverageRank)
    }

    @Test
    fun `so Framboesa, sem Oscar`() {
        val result = requireNotNull(report(1 to listOf(win(razzie, "pior filme", 2012))))
        assertEquals(
            "1 filme da lista concorreu à Framboesa de Ouro; 1 levou. Do outro lado, nenhum ganhou Oscar.",
            result.headline
        )
        assertEquals("levou a Framboesa", result.razzies.single().detail)
        assertEquals(emptyList<AwardsRow>(), result.mostAwarded)
        assertEquals(emptyList<AwardsRow>(), result.both)
    }

    @Test
    fun `mais premiados ficam nos 5 primeiros, com desempate por Oscar e posicao`() {
        val films = (1..7).map { id -> id to listOf(win("BAFTA")) }.toMutableList()
        films[6] = 7 to listOf(win("Oscar"))
        val result = requireNotNull(report(*films.toTypedArray()))
        assertEquals(listOf(7, 1, 2, 3, 4), result.mostAwarded.map { it.position })
    }
}
