package io.github.guilhermetelles.lombada.ui.retro

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.Retro
import io.github.guilhermetelles.lombada.domain.Formatting
import io.github.guilhermetelles.lombada.domain.QuizScoreboard
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.components.MovieCover
import io.github.guilhermetelles.lombada.ui.feed.EmptyState
import io.github.guilhermetelles.lombada.ui.feed.LoadingBlock
import io.github.guilhermetelles.lombada.ui.feed.ScreenColumn
import io.github.guilhermetelles.lombada.ui.feed.SectionCard
import io.github.guilhermetelles.lombada.ui.main.MovieRoute
import io.github.guilhermetelles.lombada.ui.main.RetroRoute
import io.github.guilhermetelles.lombada.ui.main.ScreenContext
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map

/** Carregamento da retrospectiva. */
private sealed interface RetroLoad {
    /** Ainda lendo. */
    data object Loading : RetroLoad

    /**
     * Lida.
     *
     * @property retro A retrospectiva, ou null se ainda não foi gerada.
     */
    data class Loaded(val retro: Retro?) : RetroLoad
}

/**
 * Retrospectiva de um mês. Ponto de entrada do pacote, registrado no `MainScreen`.
 *
 * @param context Lista, pessoa logada e navegação.
 * @param route Argumentos da rota.
 */
@Composable
fun RetroEntry(context: ScreenContext, route: RetroRoute) {
    val container = appContainer()
    val listId = context.list.id
    val flow: Flow<RetroLoad> =
        remember(listId, route.month) {
            container.retros
                .observe(listId, route.month)
                .map<Retro?, RetroLoad> { RetroLoad.Loaded(it) }
                .catch { emit(RetroLoad.Loaded(null)) }
        }
    val load by flow.collectAsStateWithLifecycle(initialValue = RetroLoad.Loading)
    val listState by context.listViewModel.state.collectAsStateWithLifecycle()
    val label = runCatching { QuizScoreboard.monthLabel(route.month) }.getOrDefault(route.month)
    val monthName = runCatching { QuizScoreboard.monthName(route.month) }.getOrDefault(route.month)

    ScreenColumn(title = "Retrospectiva de $monthName", onBack = context.back) {
        when (val current = load) {
            RetroLoad.Loading -> LoadingBlock()

            is RetroLoad.Loaded -> {
                val retro = current.retro
                if (retro == null) {
                    EmptyState(
                        "A retrospectiva de $label ainda não saiu",
                        "Ela é montada no dia 1 do mês seguinte, quando o mês fecha com filmes na lista."
                    )
                } else {
                    RetroBody(retro, label, listState.ranking, listState.positions) { context.navigate(it) }
                }
            }
        }
    }
}

@Composable
private fun RetroBody(
    retro: Retro,
    label: String,
    ranking: List<Entry>,
    positions: Map<String, Int>,
    onOpen: (MovieRoute) -> Unit
) {
    Text(
        label.replaceFirstChar { it.uppercase() },
        style = MaterialTheme.typography.headlineSmall.copy(fontSize = 26.sp),
        modifier = Modifier.padding(horizontal = 20.dp).semantics { heading() }
    )
    if (retro.films == 0) {
        EmptyState("Nenhum filme neste mês", "Vocês não registraram filmes vistos em $label.")
        return
    }
    Row(
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 14.dp)
    ) {
        Tile(retro.films.toString(), if (retro.films == 1) "filme" else "filmes", Modifier.weight(1f))
        Tile(hours(retro.minutes), "de filme juntos", Modifier.weight(1f))
    }
    val best = ranking.firstOrNull { it.id == retro.bestEntryId }
    val worst = ranking.firstOrNull { it.id == retro.worstEntryId }?.takeIf { it.id != best?.id }
    if (best != null || worst != null) {
        SectionCard(title = "Melhor e pior do mês", subtitle = "Pela posição de hoje no ranking.") {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                best?.let { FilmRow(it, "O mais bem colocado", positions[it.id], onOpen) }
                worst?.let { FilmRow(it, "O pior colocado", positions[it.id], onOpen) }
            }
        }
    }
    retro.text?.let {
        SectionCard(
            title = "O mês em um parágrafo",
            subtitle = "Texto gerado pelo Gemini a partir dos comentários de vocês."
        ) {
            Text(it, style = MaterialTheme.typography.bodyLarge.copy(lineHeight = 24.sp))
        }
    }
    if (retro.genres.isNotEmpty()) {
        SectionCard(title = "Gêneros do mês", subtitle = "Um filme pode ter mais de um gênero.") {
            GenreBars(retro.genres)
        }
    }
}

@Composable
private fun Tile(value: String, unit: String, modifier: Modifier = Modifier) {
    Column(
        modifier =
            modifier
                .background(LombadaColors.Shelf, MaterialTheme.shapes.large)
                .padding(16.dp)
                .semantics(mergeDescendants = true) {}
    ) {
        Text(value, style = MaterialTheme.typography.headlineSmall.copy(fontSize = 28.sp))
        Text(unit, style = MaterialTheme.typography.bodyMedium, color = LombadaColors.Paper2)
    }
}

@Composable
private fun FilmRow(entry: Entry, label: String, position: Int?, onOpen: (MovieRoute) -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(role = Role.Button) {
                    onOpen(MovieRoute(entry.tmdbId, entry.movie.title, entry.movie.year, entry.movie.posterPath))
                }.padding(vertical = 4.dp)
                .semantics(mergeDescendants = true) {}
    ) {
        MovieCover(entry.movie.title, entry.movie.posterPath, entry.tmdbId, Modifier.width(48.dp), initialsSize = 12.sp)
        Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
            Text(entry.movie.title, style = MaterialTheme.typography.bodyLarge)
            Text(label, style = MaterialTheme.typography.bodySmall, color = LombadaColors.Paper3)
        }
        position?.let { Text("#$it", style = MaterialTheme.typography.titleMedium, color = LombadaColors.Sticker) }
    }
}

@Composable
private fun GenreBars(genres: List<Pair<String, Int>>) {
    val top = genres.maxOf { it.second }.coerceAtLeast(1)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        genres.take(8).forEach { (genre, count) ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.clearAndSetSemantics {
                    contentDescription =
                        "$genre: ${Formatting.count(count, "filme", "filmes")}"
                }
            ) {
                Text(
                    genre,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.width(110.dp),
                    maxLines = 1
                )
                Box(
                    Modifier
                        .weight(1f)
                        .height(10.dp)
                        .clip(CircleShape)
                        .background(LombadaColors.Ground)
                ) {
                    Box(
                        Modifier
                            .fillMaxWidth(count.toFloat() / top)
                            .fillMaxHeight()
                            .background(LombadaColors.Sticker)
                    )
                }
                Text(
                    count.toString(),
                    style = MaterialTheme.typography.titleSmall,
                    modifier = Modifier.padding(start = 10.dp)
                )
            }
        }
    }
}

private fun hours(minutes: Int): String {
    val h = minutes / 60
    val m = minutes % 60
    return when {
        h == 0 -> "${m}min"
        m == 0 -> "${h}h"
        else -> "${h}h${m.toString().padStart(2, '0')}"
    }
}
