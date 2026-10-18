package io.github.guilhermetelles.lombada.ui.memory

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.domain.BrazilDay
import io.github.guilhermetelles.lombada.domain.Formatting
import io.github.guilhermetelles.lombada.domain.MemoryPick
import io.github.guilhermetelles.lombada.domain.MemoryQueue
import io.github.guilhermetelles.lombada.domain.QuizScoreboard
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.components.LombadaButton
import io.github.guilhermetelles.lombada.ui.components.LombadaButtonStyle
import io.github.guilhermetelles.lombada.ui.components.MovieCover
import io.github.guilhermetelles.lombada.ui.feed.ChoiceChips
import io.github.guilhermetelles.lombada.ui.feed.EmptyState
import io.github.guilhermetelles.lombada.ui.feed.LoadingBlock
import io.github.guilhermetelles.lombada.ui.feed.ScreenColumn
import io.github.guilhermetelles.lombada.ui.feed.SectionCard
import io.github.guilhermetelles.lombada.ui.main.MemoryRoute
import io.github.guilhermetelles.lombada.ui.main.MovieRoute
import io.github.guilhermetelles.lombada.ui.main.NotifySettingsRoute
import io.github.guilhermetelles.lombada.ui.main.ScreenContext
import io.github.guilhermetelles.lombada.ui.notify.FREQUENCIES
import io.github.guilhermetelles.lombada.ui.notify.NotifyPrefsViewModel
import io.github.guilhermetelles.lombada.ui.quiz.QuoteBlock
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import io.github.guilhermetelles.lombada.ui.theme.RankSticker
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/**
 * Comentário do dia. Ponto de entrada do pacote, registrado no `MainScreen`.
 *
 * @param context Lista, pessoa logada e navegação.
 * @param route Argumentos da rota.
 */
@Composable
fun MemoryEntry(context: ScreenContext, route: MemoryRoute) {
    val listState by context.listViewModel.state.collectAsStateWithLifecycle()
    val today = remember { BrazilDay.today() }
    // Com a entrada do aviso, abre nela; "Outro comentário" passa para a fila do dia.
    var useQueue by rememberSaveable { mutableStateOf(route.entryId == null) }
    var offset by rememberSaveable { mutableIntStateOf(0) }
    val queue = remember(listState.ranking, today) { MemoryQueue.queue(listState.ranking, today) }
    val fromRoute =
        listState.ranking.firstOrNull { it.id == route.entryId && it.comment.isNotBlank() }?.let { entry ->
            MemoryPick(entry, entry.watchedOn?.let { ChronoUnit.DAYS.between(it, today) } ?: -1)
        }
    val showingRoute = !useQueue && fromRoute != null
    val pick = if (showingRoute) fromRoute else queue.getOrNull(offset.mod(queue.size.coerceAtLeast(1)))

    ScreenColumn(title = "Comentário do dia", onBack = context.back) {
        when {
            listState.loading -> LoadingBlock()

            pick == null ->
                EmptyState("Nada para lembrar ainda", "Os comentários de vocês aparecem aqui 30 dias depois do filme.")

            else -> {
                MemoryCard(pick, listState.positions[pick.entry.id], today)
                Row(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 18.dp)
                ) {
                    LombadaButton(
                        "Abrir o filme",
                        onClick = { context.navigate(movieRoute(pick.entry)) },
                        modifier = Modifier.weight(1f)
                    )
                    if (if (showingRoute) queue.isNotEmpty() else queue.size > 1) {
                        LombadaButton(
                            "Outro comentário",
                            onClick = {
                                if (showingRoute) useQueue = true else offset += 1
                            },
                            style = LombadaButtonStyle.Tonal,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }
        FrequencySection { context.navigate(NotifySettingsRoute) }
    }
}

@Composable
private fun MemoryCard(pick: MemoryPick, position: Int?, today: LocalDate) {
    val entry = pick.entry
    Column(modifier = Modifier.padding(horizontal = 20.dp)) {
        Text(
            "${today.dayOfMonth} de ${QuizScoreboard.monthLabel(today.toString().take(7))}",
            style = MaterialTheme.typography.labelLarge,
            color = LombadaColors.Paper3
        )
        Text(
            if (pick.daysAgo >= 0) "${MemoryQueue.agoLabel(pick.daysAgo)}, vocês viram" else "Vocês viram",
            style = MaterialTheme.typography.headlineSmall.copy(fontSize = 26.sp),
            modifier = Modifier.padding(top = 2.dp).semantics { heading() }
        )
        Row(modifier = Modifier.padding(top = 16.dp)) {
            Box {
                MovieCover(entry.movie.title, entry.movie.posterPath, entry.tmdbId, Modifier.width(92.dp))
                if (position != null) {
                    RankSticker(position, entry.id, Modifier.offset(x = (-8).dp, y = (-8).dp), size = 32.dp)
                }
            }
            Column(modifier = Modifier.padding(start = 16.dp)) {
                Text(entry.movie.title, style = MaterialTheme.typography.titleLarge)
                val meta =
                    listOfNotNull(
                        entry.movie.year?.toString(),
                        entry.movie.directors.takeIf {
                            it.isNotEmpty()
                        }?.joinToString(" e ") { it.name }
                    )
                if (meta.isNotEmpty()) {
                    Text(
                        meta.joinToString(" · "),
                        style = MaterialTheme.typography.bodyMedium,
                        color = LombadaColors.Paper2
                    )
                }
                val seen = entry.watchedOn?.let { "Visto em ${Formatting.shortDate(it)}" }
                val now = position?.let { "hoje em #$it na lista" }
                Text(
                    listOfNotNull(seen, now).joinToString("; ").replaceFirstChar { it.uppercase() },
                    style = MaterialTheme.typography.bodyMedium,
                    color = LombadaColors.Paper3,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
        // O comentário da dupla, verbatim.
        QuoteBlock(entry.comment, Modifier.padding(top = 20.dp))
    }
}

@Composable
private fun FrequencySection(onMore: () -> Unit) {
    val container = appContainer()
    val prefsViewModel = viewModel(key = "notify-prefs") { NotifyPrefsViewModel(container) }
    val prefsState by prefsViewModel.state.collectAsStateWithLifecycle()
    val prefs = prefsState.prefs ?: return
    SectionCard(
        title = "Com que frequência lembrar",
        subtitle = "O comentário do dia chega como notificação nesse ritmo, junto com os outros avisos do dia."
    ) {
        ChoiceChips(FREQUENCIES, prefs.freq, { value -> prefsViewModel.update { it.copy(freq = value) } })
        LombadaButton(
            "Mais configurações",
            onClick = onMore,
            style = LombadaButtonStyle.Text,
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp)
        )
    }
}

private fun movieRoute(entry: Entry) =
    MovieRoute(entry.tmdbId, entry.movie.title, entry.movie.year, entry.movie.posterPath)
