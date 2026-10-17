package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Bechdel
import io.github.guilhermetelles.lombada.data.model.CastMember
import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.Movie
import io.github.guilhermetelles.lombada.data.model.MovieSnapshot
import io.github.guilhermetelles.lombada.data.model.PersonRef
import java.time.LocalDate
import java.time.YearMonth
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
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

    private fun movie(
        id: Int,
        runtime: Int = 100,
        genres: List<String> = emptyList(),
        cast: List<CastMember> = emptyList(),
        bechdel: Bechdel? = null
    ) = Movie(
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
        tmdbFetchedAt = null,
        bechdel = bechdel
    )

    private fun bechdel(rating: Int, dubious: Boolean = false) =
        Bechdel(siteId = 1, url = null, rating = rating, dubious = dubious, disputes = 0, fetchedAt = null)

    private val notOnSite =
        Bechdel(siteId = null, url = null, rating = null, dubious = false, disputes = 0, fetchedAt = null)

    /** Lista com um filme por avaliação, na ordem do ranking. */
    private fun bechdelList(ratings: List<Bechdel?>): Pair<List<Entry>, Map<Int, Movie>> {
        val entries = ratings.indices.map { entry(it + 1, 2000, null, null, emptyList()) }
        val byId = ratings.withIndex().associate { (index, rating) -> index + 1 to movie(index + 1, bechdel = rating) }
        return entries to byId
    }

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

    @Test
    fun `bechdel com porcentagem, distribuição, posições médias, 10 primeiros e duvidosas`() {
        // Posições 1 a 12; a 4 fora do site e a 6 nunca buscada não contam.
        val (entries, byId) =
            bechdelList(
                listOf(
                    bechdel(3),
                    bechdel(1),
                    bechdel(3, dubious = true),
                    notOnSite,
                    bechdel(0),
                    null,
                    bechdel(3),
                    bechdel(2, dubious = true),
                    bechdel(3),
                    bechdel(1),
                    bechdel(3),
                    bechdel(0)
                )
            )
        val report = requireNotNull(Reports.bechdel(entries, byId))
        assertEquals(10, report.rated)
        assertEquals(12, report.total)
        // 5 de 10 passam.
        assertEquals(50, report.passingPercent)
        assertEquals(
            listOf("3 de 3 · passa" to 5, "2 de 3" to 1, "1 de 3" to 2, "0 de 3" to 2),
            report.distribution.map { it.label to it.count }
        )
        // Passam: 1, 3, 7, 9, 11 (média 6,2). Não passam: 2, 5, 8, 10, 12 (média 7,4).
        assertEquals(6, report.passingAverageRank)
        assertEquals(7, report.failingAverageRank)
        // Dos 10 primeiros, 8 avaliados e 4 passam.
        assertEquals(4, report.topPassing)
        assertEquals(8, report.topRated)
        assertEquals(2, report.dubious)
    }

    @Test
    fun `bechdel sem os dois grupos não tem posições médias`() {
        val (entries, byId) = bechdelList(listOf(bechdel(3), bechdel(3)))
        val report = requireNotNull(Reports.bechdel(entries, byId))
        assertEquals(100, report.passingPercent)
        assertNull(report.passingAverageRank)
        assertNull(report.failingAverageRank)
    }

    @Test
    fun `bechdel sem nenhum avaliado não tem card`() {
        val (entries, byId) = bechdelList(listOf(null, notOnSite))
        assertNull(Reports.bechdel(entries, byId))
        assertNull(Reports.bechdel(emptyList(), emptyMap()))
    }

    @Test
    fun `bechdel sobre as avaliações do mock bate com o card do mock`() {
        // Avaliações embutidas no mock (BECHDEL do mock/index.html) na ordem da lista original:
        // critérios, "d" para duvidosa e "-" para filme sem avaliação no mock. Testa o cálculo sobre
        // esses dados; o banco real tem mais filmes casados que o mock.
        val original =
            "3 1 3 1 - 1 3 3d 0 0 2 - 0 0 3 3 0 3 - - 3d 3d 1 3 1 2 2 - 3 - 3 - 3 3 3 3d 3d 3 2d 2 1 1 1 3 " +
                "3 3 3 3 3 3d - - - - 3 1 1 3 3 - 1 0d 1 3 3 1 1 3 - 3d 1 - - 3 1 3 3 1 3d - 3 0 1 - - 1 - 3 3 - -"
        val ratings =
            original.split(" ").map { code ->
                if (code == "-") notOnSite else bechdel(code.take(1).toInt(), dubious = code.endsWith("d"))
            }
        val (entries, byId) = bechdelList(ratings)
        val report = requireNotNull(Reports.bechdel(entries, byId))
        assertEquals(56, report.passingPercent)
        assertEquals(70 to 91, report.rated to report.total)
        assertEquals(listOf(39, 5, 19, 7), report.distribution.map { it.count })
        assertEquals(45 to 42, report.passingAverageRank to report.failingAverageRank)
        assertEquals(4 to 9, report.topPassing to report.topRated)
        assertEquals(10, report.dubious)
    }
}
