package io.github.guilhermetelles.lombada.domain

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

/** Cálculos dos relatórios, a partir da lista em memória, como no mock. */
object Reports {
    private const val TOP = 10

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

    private fun countBy(keys: List<String>): List<Bar> = keys
        .groupingBy { it }
        .eachCount()
        .map { (key, count) -> Bar(key, count) }
        .sortedWith(compareByDescending<Bar> { it.count }.thenBy(byName) { it.label })

    private fun List<Double>.averageOrNull(): Double? = if (isEmpty()) null else average()

    // Math.round do JavaScript: .5 sobe.
    private fun jsRound(value: Double): Int = kotlin.math.floor(value + 0.5).roundToInt()
}
