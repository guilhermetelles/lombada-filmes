package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Bechdel
import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.Movie
import java.text.Collator
import java.time.LocalDate
import java.time.YearMonth
import java.util.Locale
import kotlin.math.ceil
import kotlin.math.roundToInt

/**
 * Uma barra dos relatórios.
 *
 * @property label Rótulo.
 * @property count Quantidade.
 * @property personId Pessoa, quando a linha abre a tela de um diretor ou ator.
 * @property photo Foto da pessoa, quando houver.
 */
data class Bar(val label: String, val count: Int, val personId: Int? = null, val photo: String? = null)

/**
 * Filme citado no resumo.
 *
 * @property title Título.
 * @property minutes Duração.
 */
data class TimedMovie(val title: String, val minutes: Int)

/**
 * Bloco "Resumo".
 *
 * @property films Filmes na lista.
 * @property totalMinutes Soma das durações conhecidas.
 * @property imdbAverage Média das notas do IMDb.
 * @property letterboxdAverage Média das notas do Letterboxd.
 * @property longest Filme mais longo.
 * @property shortest Filme mais curto.
 * @property averageAge Idade média dos filmes quando vocês viram, em anos.
 */
data class Summary(
    val films: Int,
    val totalMinutes: Int,
    val imdbAverage: Double?,
    val letterboxdAverage: Double?,
    val longest: TimedMovie?,
    val shortest: TimedMovie?,
    val averageAge: Int?
)

/**
 * Uma linha de "Vocês contra a crítica".
 *
 * @property entry Entrada.
 * @property position Posição de vocês.
 * @property score Nota de vocês.
 * @property imdbPosition Posição pela nota do IMDb.
 * @property letterboxdPosition Posição pela nota do Letterboxd.
 * @property why Explicação contra o IMDb.
 * @property youRankHigher Se vocês colocaram acima do IMDb.
 */
data class CriticRow(
    val entry: Entry,
    val position: Int,
    val score: Double,
    val imdbPosition: Int,
    val letterboxdPosition: Int,
    val why: String,
    val youRankHigher: Boolean
)

/**
 * Um mês do calendário.
 *
 * @property month Mês.
 * @property count Filmes vistos no mês.
 * @property level Intensidade do amarelo, de 0 a 4.
 * @property future Se o mês ainda não chegou.
 */
data class CalendarMonth(val month: YearMonth, val count: Int, val level: Int, val future: Boolean)

/**
 * Uma linha (ano) do calendário.
 *
 * @property year Ano.
 * @property months Os 12 meses.
 * @property total Filmes no ano.
 */
data class CalendarYear(val year: Int, val months: List<CalendarMonth>, val total: Int)

/**
 * "Filmes por mês".
 *
 * @property years Anos com filmes.
 * @property peak Mês com mais filmes.
 * @property monthlyAverage Média por mês desde o primeiro filme com data.
 * @property since Mês do primeiro filme com data.
 */
data class Calendar(
    val years: List<CalendarYear>,
    val peak: CalendarMonth?,
    val monthlyAverage: Double?,
    val since: YearMonth?
)

/**
 * "Atores mais vistos".
 *
 * @property bars Os 10 com mais filmes.
 * @property withCast Filmes que já têm elenco.
 * @property total Filmes da lista.
 */
data class TopActors(val bars: List<Bar>, val withCast: Int, val total: Int)

/**
 * Card "Teste de Bechdel".
 *
 * @property rated Filmes da lista avaliados no bechdeltest.com.
 * @property total Filmes da lista.
 * @property passingPercent Porcentagem dos avaliados que passa nos 3 critérios, arredondada.
 * @property distribution Barras por critérios cumpridos, de 3 a 0.
 * @property passingAverageRank Posição média no ranking de quem passa; null sem os dois grupos.
 * @property failingAverageRank Posição média no ranking de quem não passa; null sem os dois grupos.
 * @property topPassing Quantos dos 10 primeiros passam.
 * @property topRated Quantos dos 10 primeiros foram avaliados.
 * @property dubious Avaliações que o site marca como duvidosas.
 */
data class BechdelReport(
    val rated: Int,
    val total: Int,
    val passingPercent: Int,
    val distribution: List<Bar>,
    val passingAverageRank: Int?,
    val failingAverageRank: Int?,
    val topPassing: Int,
    val topRated: Int,
    val dubious: Int
)

/**
 * Um filme numa lista do card "Oscar contra Framboesa".
 *
 * @property entry Entrada.
 * @property position Posição no ranking, a partir de 1.
 * @property detail Linha embaixo do título ("3 vitórias · 1 Oscar", "levou a Framboesa").
 */
data class AwardsRow(val entry: Entry, val position: Int, val detail: String)

/**
 * Card "Oscar contra Framboesa".
 *
 * @property headline Frase de abertura com as contagens.
 * @property mostAwarded Até 5 filmes com mais vitórias fora a Framboesa.
 * @property razzies Filmes que concorreram à Framboesa, quem levou mais primeiro.
 * @property both Filmes que concorreram ao Oscar e à Framboesa.
 * @property oscarAverageRank Posição média de quem ganhou Oscar; null sem os dois grupos.
 * @property razzieAverageRank Posição média de quem concorreu à Framboesa; null sem os dois grupos.
 */
data class AwardsReport(
    val headline: String,
    val mostAwarded: List<AwardsRow>,
    val razzies: List<AwardsRow>,
    val both: List<AwardsRow>,
    val oscarAverageRank: Int?,
    val razzieAverageRank: Int?
)

/** Cálculos dos relatórios, a partir da lista em memória, como no mock. */
object Reports {
    private const val TOP = 10
    private const val MOST_AWARDED = 5
    private const val OSCAR = "Oscar"

    // Desempate pelo nome como o localeCompare do mock: "Ação" antes de "Animação".
    private val collator = Collator.getInstance(Locale.forLanguageTag("pt-BR"))
    private val byName = Comparator<String> { a, b -> collator.compare(a, b) }

    /** Abreviações dos meses, como no mock. */
    val MONTHS = listOf("jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez")

    /**
     * Resumo: quantidade, horas juntos, médias das notas e fatos.
     *
     * @param ranking Entradas.
     * @param movies Filmes da lista, por id.
     * @return O resumo.
     */
    fun summary(ranking: List<Entry>, movies: Map<Int, Movie>): Summary {
        val timed =
            ranking.mapNotNull { entry ->
                movies[entry.tmdbId]?.runtime?.takeIf { it > 0 }?.let { TimedMovie(entry.movie.title, it) }
            }
        val ages = ranking.mapNotNull { entry ->
            entry.watchedOn?.year?.let { seen -> entry.movie.year?.let { seen - it } }
        }
        return Summary(
            films = ranking.size,
            totalMinutes = timed.sumOf { it.minutes },
            imdbAverage = ranking.mapNotNull { it.movie.imdb }.averageOrNull(),
            letterboxdAverage = ranking.mapNotNull { it.movie.letterboxd }.averageOrNull(),
            // Como o reduce do mock: no empate fica o primeiro do ranking.
            longest = timed.fold(null as TimedMovie?) { best, movie ->
                if (best == null ||
                    movie.minutes > best.minutes
                ) {
                    movie
                } else {
                    best
                }
            },
            shortest = timed.fold(null as TimedMovie?) { best, movie ->
                if (best == null ||
                    movie.minutes < best.minutes
                ) {
                    movie
                } else {
                    best
                }
            },
            averageAge = ages.map { it.toDouble() }.averageOrNull()?.let { jsRound(it) }
        )
    }

    /**
     * "Vocês contra a crítica" para as entradas pedidas.
     *
     * @param ranking Entradas na ordem do ranking.
     * @param shown Entradas a mostrar, na ordem desejada.
     * @return As linhas.
     */
    fun critics(ranking: List<Entry>, shown: List<Entry>): List<CriticRow> {
        val imdbOrder = Standing.orderBy(ranking, RatingSource.Imdb).withIndex().associate { (index, entry) ->
            entry.id to
                index + 1
        }
        val letterboxdOrder = Standing.orderBy(
            ranking,
            RatingSource.Letterboxd
        ).withIndex().associate { (index, entry) ->
            entry.id to
                index + 1
        }
        val rank = ranking.withIndex().associate { (index, entry) -> entry.id to index + 1 }
        return shown.map { entry ->
            val position = rank.getValue(entry.id)
            val imdb = imdbOrder.getValue(entry.id)
            val gap = imdb - position
            val positions = if (kotlin.math.abs(gap) == 1) "posição" else "posições"
            CriticRow(
                entry = entry,
                position = position,
                score = CoupleScore.of(position, ranking.size),
                imdbPosition = imdb,
                letterboxdPosition = letterboxdOrder.getValue(entry.id),
                why =
                    when {
                        gap > 0 -> "Vocês colocaram $gap $positions acima do IMDb"
                        gap < 0 -> "O IMDb coloca ${-gap} $positions acima"
                        else -> "Mesma posição que no IMDb"
                    },
                youRankHigher = gap > 0
            )
        }
    }

    /**
     * Ordem "Data em que viram": mais recentes primeiro, sem data no fim, o ranking desempata.
     *
     * @param ranking Entradas na ordem do ranking.
     * @return Entradas por data.
     */
    fun byDateNewestFirst(ranking: List<Entry>): List<Entry> = EntryOrder.byWatchedDate(ranking, newestFirst = true)

    /**
     * Os 5 últimos vistos, para a prévia.
     *
     * @param ranking Entradas na ordem do ranking.
     * @param count Quantidade.
     * @return Entradas com data, das mais recentes para as mais antigas.
     */
    fun recent(ranking: List<Entry>, count: Int = 5): List<Entry> =
        byDateNewestFirst(ranking).filter { it.watchedOn != null }.take(count)

    /**
     * "Filmes por mês": uma linha por ano, 12 meses, intensidade em 4 níveis.
     *
     * @param ranking Entradas.
     * @param today Hoje, para os meses que ainda não chegaram.
     * @return O calendário.
     */
    fun calendar(ranking: List<Entry>, today: LocalDate): Calendar {
        val dates = ranking.mapNotNull { it.watchedOn }
        if (dates.isEmpty()) return Calendar(emptyList(), null, null, null)
        val counts = dates.groupingBy { YearMonth.from(it) }.eachCount()
        val max = maxOf(1, counts.values.maxOrNull() ?: 0)
        val current = YearMonth.from(today)
        val years =
            dates.map { it.year }.distinct().sorted().map { year ->
                val months =
                    (1..12).map { month ->
                        val ym = YearMonth.of(year, month)
                        val count = counts[ym] ?: 0
                        val level = if (count == 0) 0 else minOf(4, ceil(count.toDouble() / max * 4).toInt())
                        CalendarMonth(ym, count, level, ym.isAfter(current))
                    }
                CalendarYear(year, months, months.sumOf { it.count })
            }
        // Como no mock: o primeiro mês com o máximo ganha.
        val peak = years.flatMap { it.months }.fold(null as CalendarMonth?) { best, month ->
            if (month.count >
                (best?.count ?: 0)
            ) {
                month
            } else {
                best
            }
        }
        val first = YearMonth.from(dates.min())
        val span = (current.year - first.year) * 12 + current.monthValue - first.monthValue + 1
        return Calendar(years, peak, dates.size.toDouble() / maxOf(1, span), first)
    }

    /**
     * Os 10 diretores com mais filmes; filmes com mais de um diretor contam para cada um.
     *
     * @param ranking Entradas.
     * @param movies Filmes, para as fotos.
     * @return As barras, com o id de cada diretor.
     */
    fun directors(ranking: List<Entry>, movies: Map<Int, Movie>): List<Bar> {
        val photos = movies.values.flatMap { it.directors }.filter { it.profilePath != null }.associate {
            it.id to
                it.profilePath
        }
        return ranking
            .flatMap { it.movie.directors }
            .groupBy { it.id }
            .map { (id, refs) -> Bar(refs.first().name, refs.size, id, photos[id]) }
            .sortedWith(compareByDescending<Bar> { it.count }.thenBy(byName) { it.label })
            .take(TOP)
    }

    /**
     * Os 10 atores que aparecem em mais filmes da lista, pelo elenco de cada filme; desempate
     * pelo nome. Conta só filmes que já têm elenco.
     *
     * @param ranking Entradas.
     * @param movies Filmes, com o elenco.
     * @return As barras e quantos filmes entraram na conta.
     */
    fun actors(ranking: List<Entry>, movies: Map<Int, Movie>): TopActors {
        val casts = ranking.mapNotNull { movies[it.tmdbId]?.cast?.takeIf { cast -> cast.isNotEmpty() } }
        val bars =
            casts
                .flatMap { cast -> cast.distinctBy { it.id } }
                .groupBy { it.id }
                .map { (id, members) ->
                    Bar(members.first().name, members.size, id, members.firstNotNullOfOrNull { it.profilePath })
                }
                .sortedWith(compareByDescending<Bar> { it.count }.thenBy(byName) { it.label })
                .take(TOP)
        return TopActors(bars, casts.size, ranking.size)
    }

    /**
     * Teste de Bechdel na lista: quantos passam, quantos critérios cada um cumpre e onde ficam no
     * ranking. Só contam filmes avaliados no site.
     *
     * @param ranking Entradas na ordem do ranking.
     * @param movies Filmes, com o Teste de Bechdel.
     * @return O card, ou null quando nenhum filme da lista foi avaliado.
     */
    fun bechdel(ranking: List<Entry>, movies: Map<Int, Movie>): BechdelReport? {
        // Posição no ranking (a partir de 1) e a avaliação de cada filme avaliado.
        val rated =
            ranking.withIndex().mapNotNull { (index, entry) ->
                movies[entry.tmdbId]?.bechdel?.takeIf { it.isRated }?.let { index + 1 to it }
            }
        if (rated.isEmpty()) return null
        val (passing, failing) = rated.partition { (_, bechdel) -> bechdel.passes }
        val bothGroups = passing.isNotEmpty() && failing.isNotEmpty()
        val top = rated.filter { (position, _) -> position <= TOP }
        return BechdelReport(
            rated = rated.size,
            total = ranking.size,
            passingPercent = jsRound(passing.size * 100.0 / rated.size),
            distribution =
                (Bechdel.CRITERIA downTo 0).map { criteria ->
                    Bar(
                        if (criteria == Bechdel.CRITERIA) "3 de 3 · passa" else "$criteria de 3",
                        rated.count { (_, bechdel) -> bechdel.rating == criteria }
                    )
                },
            passingAverageRank = if (bothGroups) jsRound(passing.map { it.first.toDouble() }.average()) else null,
            failingAverageRank = if (bothGroups) jsRound(failing.map { it.first.toDouble() }.average()) else null,
            topPassing = top.count { (_, bechdel) -> bechdel.passes },
            topRated = top.size,
            dubious = rated.count { (_, bechdel) -> bechdel.dubious }
        )
    }

    /**
     * Card "Oscar contra Framboesa": os mais premiados, os que concorreram à Framboesa, os que
     * tiveram os dois e a posição média de cada grupo, como no mock. Filmes sem `awards` contam
     * como sem prêmios; categoria e ano não entram na conta.
     *
     * @param ranking Entradas na ordem do ranking.
     * @param movies Filmes, com os prêmios.
     * @return O card, ou null quando nenhum filme tem vitória nem concorreu à Framboesa.
     */
    fun awards(ranking: List<Entry>, movies: Map<Int, Movie>): AwardsReport? {
        val rows =
            ranking.mapIndexed { index, entry ->
                AwardTally(entry, index + 1, AwardGroups.of(movies[entry.tmdbId]?.awards?.items.orEmpty()))
            }
        val top =
            rows
                .filter { it.wins > 0 }
                .sortedWith(
                    compareByDescending<AwardTally> { it.wins }
                        .thenByDescending { it.oscarWins }
                        .thenBy { it.position }
                ).take(MOST_AWARDED)
        val razzies =
            rows
                .filter { it.razzie != null }
                .sortedWith(
                    compareByDescending<AwardTally> { it.razzie?.wins ?: 0 }
                        .thenByDescending { it.razzie?.nominations ?: 0 }
                        .thenBy { it.position }
                )
        if (top.isEmpty() && razzies.isEmpty()) return null
        val both = rows.filter { it.razzie != null && (it.oscarWins > 0 || it.oscarNominations > 0) }
        val oscarRows = rows.filter { it.oscarWins > 0 }
        val oscarFilms = oscarRows.size
        val razzieWon = razzies.count { (it.razzie?.wins ?: 0) > 0 }
        val oscarWinners =
            when (oscarFilms) {
                0 -> "nenhum ganhou Oscar"
                1 -> "1 filme ganhou pelo menos um Oscar"
                else -> "$oscarFilms filmes ganharam pelo menos um Oscar"
            }
        val headline =
            if (razzies.isNotEmpty()) {
                val competed = if (razzies.size == 1) "concorreu" else "concorreram"
                val won =
                    when (razzieWon) {
                        0 -> "nenhum levou"
                        1 -> "1 levou"
                        else -> "$razzieWon levaram"
                    }
                "${Formatting.count(razzies.size, "filme", "filmes")} da lista $competed à Framboesa de Ouro; " +
                    "$won. Do outro lado, $oscarWinners."
            } else {
                val winners = if (oscarFilms == 1) "1 filme da lista ganhou" else "$oscarFilms filmes da lista ganharam"
                "$winners pelo menos um Oscar, e nenhum concorreu à Framboesa de Ouro."
            }
        val bothGroups = oscarRows.isNotEmpty() && razzies.isNotEmpty()
        return AwardsReport(
            headline = headline,
            mostAwarded =
                top.map { row ->
                    val oscars = row.oscarWins.takeIf { it > 0 }?.let { oscarCount(it) }
                    AwardsRow(
                        row.entry,
                        row.position,
                        listOfNotNull(Formatting.count(row.wins, "vitória", "vitórias"), oscars).joinToString(" · ")
                    )
                },
            razzies = razzies.map { AwardsRow(it.entry, it.position, razzieDetail(it)) },
            both =
                both.map { row ->
                    val oscar =
                        if (row.oscarWins > 0) {
                            "ganhou ${oscarCount(row.oscarWins)}"
                        } else {
                            "${Formatting.count(row.oscarNominations, "indicação", "indicações")} ao Oscar"
                        }
                    AwardsRow(row.entry, row.position, "$oscar e ${razzieDetail(row)}")
                },
            oscarAverageRank = if (bothGroups) jsRound(oscarRows.map { it.position.toDouble() }.average()) else null,
            razzieAverageRank = if (bothGroups) jsRound(razzies.map { it.position.toDouble() }.average()) else null
        )
    }

    /**
     * Os 10 gêneros mais frequentes; um filme conta em todos os seus gêneros.
     *
     * @param ranking Entradas.
     * @param movies Filmes, com os gêneros.
     * @return As barras.
     */
    fun genres(ranking: List<Entry>, movies: Map<Int, Movie>): List<Bar> =
        countBy(ranking.flatMap { movies[it.tmdbId]?.genres.orEmpty() }).take(TOP)

    /**
     * Década de lançamento, em ordem cronológica.
     *
     * @param ranking Entradas.
     * @return As barras ("Anos 80", "Anos 2000").
     */
    fun decades(ranking: List<Entry>): List<Bar> = ranking
        .mapNotNull { it.movie.year }
        .groupingBy { it / 10 * 10 }
        .eachCount()
        .toSortedMap()
        .map { (decade, count) ->
            Bar(
                if (decade >=
                    2000
                ) {
                    "Anos $decade"
                } else {
                    "Anos ${decade.toString().takeLast(2)}"
                },
                count
            )
        }

    /**
     * Duração em horas, como `117h05`.
     *
     * @param minutes Minutos.
     * @return Texto.
     */
    fun hours(minutes: Int): String = "${minutes / 60}h${(minutes % 60).toString().padStart(2, '0')}"

    /**
     * Mês curto, como `out/25`.
     *
     * @param month Mês.
     * @return Texto.
     */
    fun monthLabel(month: YearMonth): String = "${MONTHS[month.monthValue - 1]}/${month.year.toString().takeLast(2)}"

    // Prêmios de uma entrada, já agrupados por premiação.
    private class AwardTally(val entry: Entry, val position: Int, groups: List<AwardGroup>) {
        private val oscar = groups.firstOrNull { it.org == OSCAR }
        val razzie = groups.firstOrNull { it.isRazzie }
        val wins = groups.filterNot { it.isRazzie }.sumOf { it.wins }
        val oscarWins = oscar?.wins ?: 0
        val oscarNominations = oscar?.nominations ?: 0
    }

    private fun oscarCount(wins: Int): String = if (wins == 1) "1 Oscar" else "$wins Oscars"

    private fun razzieDetail(row: AwardTally): String {
        val razzie = row.razzie ?: return ""
        return when (razzie.wins) {
            0 -> "${Formatting.count(razzie.nominations, "indicação", "indicações")} à Framboesa"
            1 -> "levou a Framboesa"
            else -> "levou ${razzie.wins} Framboesas"
        }
    }

    private fun countBy(keys: List<String>): List<Bar> = keys
        .groupingBy { it }
        .eachCount()
        .map { (key, count) -> Bar(key, count) }
        .sortedWith(compareByDescending<Bar> { it.count }.thenBy(byName) { it.label })

    private fun List<Double>.averageOrNull(): Double? = if (isEmpty()) null else average()

    // Math.round do JavaScript: .5 sobe.
    private fun jsRound(value: Double): Int = kotlin.math.floor(value + 0.5).roundToInt()
}
