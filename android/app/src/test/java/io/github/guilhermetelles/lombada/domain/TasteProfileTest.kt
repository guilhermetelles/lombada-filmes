package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.Movie
import io.github.guilhermetelles.lombada.data.model.MovieSnapshot
import io.github.guilhermetelles.lombada.data.model.PersonRef
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TasteProfileTest {
    private val coen = PersonRef(1, "Joel Coen")
    private val cameron = PersonRef(2, "James Cameron")
    private val wilder = PersonRef(3, "Billy Wilder")

    private fun entry(id: Int, year: Int?, vararg directors: PersonRef) =
        Entry("e$id", id, "a$id", null, "", "u", MovieSnapshot("Filme $id", year, null, null, null, directors.toList()))

    private fun movie(id: Int, genres: List<String>, runtime: Int? = 100) = Movie(
        tmdbId = id,
        title = "Filme $id",
        year = null,
        directors = emptyList(),
        cast = emptyList(),
        runtime = runtime,
        genres = genres,
        synopsisPt = null,
        synopsisEn = null,
        posterPath = null,
        imdbId = null,
        letterboxdUrl = null,
        letterboxd = null,
        imdb = null,
        rottenTomatoes = null,
        metacritic = null,
        tmdbFetchedAt = null
    )

    @Test
    fun `lista vazia dá perfil vazio`() {
        val profile = TasteProfiles.of(emptyList(), emptyMap())
        assertTrue(profile.isEmpty)
        assertEquals(0, profile.films)
        assertNull(profile.averageMinutes)
    }

    @Test
    fun `gênero no topo pesa mais que o mesmo número de filmes embaixo`() {
        // 4 filmes: notas 10, 7, 4 e 1. Drama no 1º e 4º (11); Terror no 2º e 3º (11) empata no peso
        // e perde na melhor posição; Comédia só no 2º.
        val ranking = listOf(entry(1, 1990), entry(2, 1991), entry(3, 2005), entry(4, 2010))
        val movies =
            mapOf(
                1 to movie(1, listOf("Drama")),
                2 to movie(2, listOf("Terror", "Comédia")),
                3 to movie(3, listOf("Terror")),
                4 to movie(4, listOf("Drama"))
            )
        val genres = TasteProfiles.of(ranking, movies).genres
        assertEquals(listOf("Drama", "Terror", "Comédia"), genres.map { it.label })
        assertEquals(listOf(2, 2, 1), genres.map { it.count })
        assertEquals(listOf(1, 2, 2), genres.map { it.bestPosition })
        assertEquals(11.0, genres.first().weight, 1e-9)
    }

    @Test
    fun `mais filmes vencem um só no topo`() {
        // Notas 10, 7, 4 e 1: Crime no 2º, 3º e 4º soma 12 e passa do Drama do 1º (10).
        val ranking = (1..4).map { entry(it, 2000) }
        val movies =
            mapOf(
                1 to movie(1, listOf("Drama")),
                2 to movie(2, listOf("Crime")),
                3 to movie(3, listOf("Crime")),
                4 to movie(4, listOf("Crime"))
            )
        assertEquals(listOf("Crime", "Drama"), TasteProfiles.of(ranking, movies).genres.map { it.label })
    }

    @Test
    fun `décadas vêm da entrada e mostram até três`() {
        val ranking =
            listOf(
                entry(1, 1994),
                entry(2, 1996),
                entry(3, 2001),
                entry(4, 1985),
                entry(5, 2015),
                entry(6, null)
            )
        val decades = TasteProfiles.of(ranking, emptyMap()).decades
        assertEquals(listOf("Anos 90", "Anos 2000", "Anos 80"), decades.map { it.label })
        assertEquals(2, decades.first().count)
    }

    @Test
    fun `diretores só com dois filmes ou mais, com o id`() {
        val ranking =
            listOf(
                entry(1, 1998, coen),
                entry(2, 1989, cameron),
                entry(3, 1996, coen),
                entry(4, 1986, cameron),
                entry(5, 1944, wilder)
            )
        val directors = TasteProfiles.of(ranking, emptyMap()).directors
        assertEquals(listOf("Joel Coen", "James Cameron"), directors.map { it.label })
        assertEquals(listOf(1, 2), directors.map { it.personId })
        assertEquals(listOf(1, 2), directors.map { it.bestPosition })
    }

    @Test
    fun `filme com dois diretores conta para cada um e uma vez só`() {
        val ethan = PersonRef(4, "Ethan Coen")
        val ranking = listOf(entry(1, 1998, coen, ethan, coen), entry(2, 1996, coen, ethan))
        val directors = TasteProfiles.of(ranking, emptyMap()).directors
        assertEquals(setOf("Joel Coen", "Ethan Coen"), directors.map { it.label }.toSet())
        assertTrue(directors.all { it.count == 2 })
    }

    @Test
    fun `duração média ignora filmes sem duração e os que não chegaram`() {
        val ranking = listOf(entry(1, 2000), entry(2, 2000), entry(3, 2000))
        val movies = mapOf(1 to movie(1, emptyList(), 90), 2 to movie(2, emptyList(), null))
        assertEquals(90, TasteProfiles.of(ranking, movies).averageMinutes)
    }

    @Test
    fun `no máximo cinco gêneros`() {
        val ranking = listOf(entry(1, 2000))
        val movies = mapOf(1 to movie(1, listOf("A", "B", "C", "D", "E", "F", "A")))
        val genres = TasteProfiles.of(ranking, movies).genres
        assertEquals(TasteProfiles.TOP_GENRES, genres.size)
        assertTrue(genres.all { it.count == 1 })
    }
}
