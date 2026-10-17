package io.github.guilhermetelles.lombada.ui.reports

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.guilhermetelles.lombada.domain.BechdelReport
import io.github.guilhermetelles.lombada.domain.Formatting
import io.github.guilhermetelles.lombada.domain.Reports
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.main.MovieRoute
import io.github.guilhermetelles.lombada.ui.main.PersonRoute
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

private val CALENDAR_SUBTITLE =
    buildString {
        append("Pela data em que vocês assistiram. Cada quadrado é um mês com o número de filmes; ")
        append("quanto mais forte o amarelo, mais filmes.")
    }

private const val BECHDEL_SUBTITLE =
    "Duas mulheres com nome conversam entre si sobre algo que não seja um homem? " +
        "Avaliações da comunidade do bechdeltest.com."

private const val DIRECTORS_SUBTITLE =
    "Os 10 diretores com mais filmes na lista. Toque num nome para ver os filmes dele."

/**
 * Relatórios: resumo, prévia de "Vocês contra a crítica", filmes por mês, diretores, atores,
 * Teste de Bechdel, gêneros, décadas e o acesso ao consumo das APIs. Tudo calculado da lista em memória.
 *
 * @param listId Lista ativa.
 * @param onOpenMovie Abre um filme.
 * @param onOpenPerson Abre um diretor ou ator.
 * @param onOpenCritics Abre a comparação completa.
 * @param onOpenUsage Abre o consumo das APIs.
 */
@Composable
fun ReportsScreen(
    listId: String,
    onOpenMovie: (MovieRoute) -> Unit,
    onOpenPerson: (PersonRoute) -> Unit,
    onOpenCritics: () -> Unit,
    onOpenUsage: () -> Unit
) {
    val container = appContainer()
    val viewModel = viewModel(key = "reports-$listId") { ReportsViewModel(container, listId) }
    val state by viewModel.state.collectAsStateWithLifecycle()

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(LombadaColors.Ground)
                .statusBarsPadding()
                .verticalScroll(rememberScrollState())
                .padding(bottom = 20.dp)
    ) {
        Column(modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 4.dp)) {
            Text(
                "Relatórios",
                style = MaterialTheme.typography.headlineSmall.copy(
                    fontSize = 24.sp,
                    fontWeight = FontWeight.ExtraBold
                ),
                modifier = Modifier.semantics {
                    heading()
                }
            )
            Text(
                "Calculados a partir da lista de vocês e dos dados de catálogo de cada filme.",
                style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 20.sp),
                color = LombadaColors.Paper2,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
        when {
            state.loading -> Box(Modifier.fillMaxWidth().padding(48.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = LombadaColors.Sticker)
            }

            state.ranking.isEmpty() -> Empty()

            else -> Content(state, onOpenMovie, onOpenPerson, onOpenCritics, onOpenUsage)
        }
    }
}

@Composable
private fun Content(
    state: ReportsUiState,
    onOpenMovie: (MovieRoute) -> Unit,
    onOpenPerson: (PersonRoute) -> Unit,
    onOpenCritics: () -> Unit,
    onOpenUsage: () -> Unit
) {
    val summary = state.summary ?: return
    ReportSection("Resumo", AnnotatedString("Duração e notas vêm do catálogo de cada filme.")) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatTile(
                    summary.films.toString(),
                    null,
                    if (summary.films ==
                        1
                    ) {
                        "filme na lista"
                    } else {
                        "filmes na lista"
                    },
                    Modifier.weight(1f)
                )
                StatTile(Reports.hours(summary.totalMinutes), null, "de filme juntos", Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatTile(Formatting.oneDecimal(summary.imdbAverage), "/10", "média no IMDb", Modifier.weight(1f))
                StatTile(
                    Formatting.oneDecimal(summary.letterboxdAverage),
                    "/5",
                    "média no Letterboxd",
                    Modifier.weight(1f)
                )
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 12.dp)) {
            summary.longest?.let { Fact("Mais longo: ", Formatting.shortTitle(it.title), ", ${it.minutes} min") }
            summary.shortest?.let { Fact("Mais curto: ", Formatting.shortTitle(it.title), ", ${it.minutes} min") }
            summary.averageAge?.let { Fact("Em média, os filmes tinham ", "$it anos", " quando vocês viram") }
        }
    }

    val recent = Reports.critics(state.ranking, state.recent)
    ReportSection(
        "Vocês contra a crítica",
        AnnotatedString(
            "Os ${recent.size} últimos que vocês viram: a posição no ranking de vocês e onde o filme " +
                "ficaria se a lista fosse ordenada pela nota do IMDb ou do Letterboxd. " +
                "Embaixo de cada posição, a nota."
        ),
        onClick = onOpenCritics
    ) {
        CriticsTable(recent) { row ->
            onOpenMovie(
                MovieRoute(row.entry.tmdbId, row.entry.movie.title, row.entry.movie.year, row.entry.movie.posterPath)
            )
        }
        SeeAll("Ver os ${state.ranking.size} filmes", onOpenCritics)
    }

    state.calendar?.takeIf { it.years.isNotEmpty() }?.let { calendar ->
        ReportSection(
            "Filmes por mês",
            AnnotatedString(CALENDAR_SUBTITLE)
        ) { CalendarGrid(calendar) }
    }

    ReportSection(
        "Diretores",
        AnnotatedString(DIRECTORS_SUBTITLE)
    ) {
        BarChart(state.directors, showPhotos = true) { bar ->
            onOpenPerson(PersonRoute(requireNotNull(bar.personId), bar.label, bar.photo, "directing"))
        }
    }

    state.actors?.let { actors ->
        val subtitle =
            buildAnnotatedString {
                append("Quem aparece em mais filmes da lista, pelo elenco de cada filme no TMDb. ")
                append("Toque num nome para ver a ficha.")
                if (actors.withCast < actors.total) {
                    append(" ")
                    withStyle(SpanStyle(color = LombadaColors.Sticker, fontWeight = FontWeight.SemiBold)) {
                        append("Calculado com ${actors.withCast} de ${actors.total} filmes.")
                    }
                }
            }
        ReportSection("Atores mais vistos", subtitle) {
            BarChart(actors.bars, showPhotos = true) { bar ->
                onOpenPerson(PersonRoute(requireNotNull(bar.personId), bar.label, bar.photo, "acting"))
            }
        }
    }

    state.bechdel?.let { BechdelCard(it) }

    ReportSection("Gêneros", AnnotatedString("Os 10 gêneros mais frequentes. Um filme pode contar em mais de um.")) {
        BarChart(state.genres)
    }
    ReportSection("Década de lançamento", AnnotatedString("Quando os filmes da lista foram lançados.")) {
        BarChart(state.decades)
    }
    ReportSection(
        "Consumo das APIs",
        AnnotatedString("Pedidos feitos pelo backend a cada fonte e o uso da cota diária da OMDb."),
        onClick = onOpenUsage
    ) { SeeAll("Ver consumo", onOpenUsage) }
    Text(
        "Notas do IMDb, Rotten Tomatoes e Metacritic pela OMDb; nota do Letterboxd pelas páginas " +
            "públicas do Letterboxd; Teste de Bechdel pelo bechdeltest.com; catálogo, elenco e fichas " +
            "pelo TMDb. Este app usa a API do TMDb, " +
            "mas não é endossado nem certificado pelo TMDb.",
        style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.5.sp, lineHeight = 19.sp),
        color = LombadaColors.Paper3,
        modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 8.dp)
    )
}

/**
 * Card "Teste de Bechdel": quantos passam, quantos foram avaliados, as barras por critérios e os
 * fatos de posição no ranking, 10 primeiros e avaliações duvidosas.
 */
@Composable
private fun BechdelCard(report: BechdelReport) {
    ReportSection("Teste de Bechdel", AnnotatedString(BECHDEL_SUBTITLE)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StatTile(report.passingPercent.toString(), "%", "passam nos 3 critérios", Modifier.weight(1f))
            StatTile(report.rated.toString(), "/${report.total}", "filmes avaliados no site", Modifier.weight(1f))
        }
        Box(Modifier.padding(top = 14.dp)) { BarChart(report.distribution) }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 12.dp)) {
            val passing = report.passingAverageRank
            val failing = report.failingAverageRank
            if (passing != null && failing != null) {
                Fact(
                    "Quem passa fica em média em " to false,
                    "#$passing" to true,
                    " no ranking de vocês; quem não passa, em " to false,
                    "#$failing" to true
                )
            }
            if (report.topRated > 0) {
                Fact(
                    "Dos 10 primeiros do ranking, " to false,
                    "${report.topPassing} de ${report.topRated}" to true,
                    " avaliados passam" to false
                )
            }
            if (report.dubious > 0) {
                Fact(
                    "${report.dubious}" to true,
                    (
                        if (report.dubious ==
                            1
                        ) {
                            " avaliação é marcada como duvidosa"
                        } else {
                            " avaliações são marcadas como duvidosas"
                        }
                        ) +
                        " pelo site" to false
                )
            }
        }
    }
}

@Composable
private fun Fact(before: String, bold: String, after: String) {
    Fact(before to false, bold to true, after to false)
}

/**
 * Linha de fato com trechos em destaque.
 *
 * @param parts Trechos, cada um com se vai em destaque.
 */
@Composable
private fun Fact(vararg parts: Pair<String, Boolean>) {
    Text(
        buildAnnotatedString {
            parts.forEach { (text, bold) ->
                if (bold) {
                    withStyle(SpanStyle(color = LombadaColors.Paper, fontWeight = FontWeight.SemiBold)) { append(text) }
                } else {
                    append(text)
                }
            }
        },
        style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 20.sp),
        color = LombadaColors.Paper2
    )
}

@Composable
private fun Empty() {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 28.dp, vertical = 36.dp)
    ) {
        Text("Nada para medir ainda", style = MaterialTheme.typography.titleLarge, textAlign = TextAlign.Center)
        Text(
            "Adicione filmes à lista para ver os relatórios.",
            style = MaterialTheme.typography.bodyLarge,
            color = LombadaColors.Paper2,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp)
        )
    }
}
