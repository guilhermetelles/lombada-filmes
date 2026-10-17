package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.CastMember
import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.Movie
import io.github.guilhermetelles.lombada.data.model.MovieSnapshot
import io.github.guilhermetelles.lombada.data.model.PersonRef
import java.time.LocalDate
import java.time.YearMonth
import org.junit.Assert.assertEquals
import org.junit.Test

class ReportsTest {
    private fun entry(id: Int, year: Int, date: String?, imdb: Double?, directors: List<PersonRef>) = Entry(
        "e$id",
        id,
        "a$id",
        date?.let(LocalDate::parse),
        "",
        "u",
        MovieSnapshot("Filme $id", year, null, imdb, 3.0, directors)
    )

    private fun movie(id: Int, runtime: Int, genres: List<String>, cast: List<CastMember>) = Movie(
        tmdbId = id,
        title = "Filme $id",
        year = null,
        directors = emptyList(),
        cast = cast,
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

    private val cameron = PersonRef(2710, "James Cameron")
    private val coen = PersonRef(1223, "Joel Coen")
    private val ranking =
        listOf(
            entry(1, 1989, "2025-10-12", 7.5, listOf(cameron)),
            entry(2, 1986, "2025-10-20", 8.4, listOf(cameron)),
            entry(3, 1998, null, null, listOf(coen)),
            entry(4, 2001, "2026-01-05", 7.0, listOf(coen, PersonRef(1224, "Ethan Coen")))
        )
    private val harris = CastMember(228, "Ed Harris", null, "/eh.jpg")
    private val movies =
        mapOf(
            1 to movie(1, 140, listOf("Aventura", "Ficção científica"), listOf(harris)),
            2 to
                movie(
                    2,
                    137,
                    listOf("Ação", "Ficção científica"),
                    listOf(harris, CastMember(2712, "Michael Biehn", null, null))
                ),
            3 to movie(3, 117, listOf("Comédia"), emptyList()),
            4 to movie(4, 106, listOf("Animação"), listOf(CastMember(1, "Ana", null, null)))
        )

    @Test
    fun `resumo com horas, médias e fatos`() {
        val summary = Reports.summary(ranking, movies)
        assertEquals(4, summary.films)
        assertEquals("8h20", Reports.hours(summary.totalMinutes))
        assertEquals("7.6", Formatting.oneDecimal(summary.imdbAverage))
        assertEquals(TimedMovie("Filme 1", 140), summary.longest)
        assertEquals(TimedMovie("Filme 4", 106), summary.shortest)
        // 36, 39 e 25 anos: média 33,3.
        assertEquals(33, summary.averageAge)
    }

    @Test
    fun `diretores contam cada um num filme com mais de um`() {
        val bars = Reports.directors(ranking, movies)
        assertEquals(
            listOf("James Cameron" to 2, "Joel Coen" to 2, "Ethan Coen" to 1),
            bars.map {
                it.label to it.count
            }
        )
    }

    @Test
    fun `atores contam só filmes com elenco`() {
        val actors = Reports.actors(ranking, movies)
        assertEquals(3, actors.withCast)
        assertEquals(4, actors.total)
        assertEquals("Ed Harris" to 2, actors.bars.first().let { it.label to it.count })
        assertEquals("/eh.jpg", actors.bars.first().photo)
    }

    @Test
    fun `gêneros desempatam como o localeCompare`() {
        assertEquals(
            listOf("Ficção científica", "Ação", "Animação", "Aventura", "Comédia"),
            Reports.genres(ranking, movies).map {
                it.label
            }
        )
    }

    @Test
    fun `décadas em ordem`() {
        assertEquals(
            listOf("Anos 80" to 2, "Anos 90" to 1, "Anos 2000" to 1),
            Reports.decades(ranking).map {
                it.label to
                    it.count
            }
        )
    }

    @Test
    fun `calendário com níveis, mês de pico e média`() {
        val calendar = Reports.calendar(ranking, LocalDate.parse("2026-02-10"))
        assertEquals(listOf(2025, 2026), calendar.years.map { it.year })
        val october = calendar.years[0].months[9]
        assertEquals(2, october.count)
        assertEquals(4, october.level)
        assertEquals(2, calendar.years[1].months[0].level)
        assertEquals(true, calendar.years[1].months[2].future)
        assertEquals(YearMonth.of(2025, 10), calendar.peak?.month)
        // 3 filmes em 5 meses (out/25 a fev/26).
        assertEquals("0.6", Formatting.oneDecimal(calendar.monthlyAverage))
    }

    @Test
    fun `últimos vistos e comparação com o IMDb`() {
        val recent = Reports.recent(ranking)
        assertEquals(listOf("e4", "e2", "e1"), recent.map { it.id })
        val row = Reports.critics(ranking, recent).first { it.entry.id == "e1" }
        // IMDb ordena 2, 1, 4, 3: o 1º de vocês fica em 2º.
        assertEquals(2, row.imdbPosition)
        assertEquals("Vocês colocaram 1 posição acima do IMDb", row.why)
    }
}
