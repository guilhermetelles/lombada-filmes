package io.github.guilhermetelles.lombada.ui.reports

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.guilhermetelles.lombada.domain.Reports
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.list.SortBar
import io.github.guilhermetelles.lombada.ui.list.SortMode
import io.github.guilhermetelles.lombada.ui.main.MovieRoute
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/**
 * "Vocês contra a crítica" completa, por ranking ou pela data em que viram.
 *
 * @param listId Lista ativa.
 * @param onBack Volta para os relatórios.
 * @param onOpenMovie Abre um filme.
 */
@Composable
fun CriticsScreen(listId: String, onBack: () -> Unit, onOpenMovie: (MovieRoute) -> Unit) {
    val container = appContainer()
    val viewModel = viewModel(key = "reports-$listId") { ReportsViewModel(container, listId) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    var mode by rememberSaveable { mutableStateOf(SortMode.Ranking) }
    val shown = if (mode == SortMode.Ranking) state.ranking else Reports.byDateNewestFirst(state.ranking)

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(LombadaColors.Ground)
                .statusBarsPadding()
                .verticalScroll(rememberScrollState())
                .navigationBarsPadding()
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.height(56.dp).padding(horizontal = 4.dp)
        ) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar") }
            Text(
                "Vocês contra a crítica",
                style = MaterialTheme.typography.titleLarge.copy(fontSize = 18.sp),
                modifier = Modifier.padding(start = 4.dp)
            )
        }
        SortBar(mode, { mode = it }, secondLabel = "Data em que viram")
        Text(
            (
                if (mode ==
                    SortMode.Ranking
                ) {
                    "Do 1º ao último do ranking de vocês."
                } else {
                    "Do mais recente ao mais antigo; filmes sem data ficam no fim."
                }
                ) +
                " IMDb e Letterb. mostram a posição que o filme teria com a lista ordenada pela nota de cada um. Embaixo de cada posição, a nota.",
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp, lineHeight = 19.sp),
            color = LombadaColors.Paper3,
            modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 6.dp)
        )
        Column(modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 24.dp)) {
            CriticsTable(Reports.critics(state.ranking, shown)) { row ->
                onOpenMovie(
                    MovieRoute(
                        row.entry.tmdbId,
                        row.entry.movie.title,
                        row.entry.movie.year,
                        row.entry.movie.posterPath
                    )
                )
            }
        }
    }
}
