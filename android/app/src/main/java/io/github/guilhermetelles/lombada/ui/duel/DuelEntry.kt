package io.github.guilhermetelles.lombada.ui.duel

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.SwapVert
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.domain.BrazilDay
import io.github.guilhermetelles.lombada.domain.DuelPair
import io.github.guilhermetelles.lombada.domain.Formatting
import io.github.guilhermetelles.lombada.events.ListEventType
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.components.MovieCover
import io.github.guilhermetelles.lombada.ui.feed.EmptyState
import io.github.guilhermetelles.lombada.ui.feed.LoadingBlock
import io.github.guilhermetelles.lombada.ui.feed.ScreenColumn
import io.github.guilhermetelles.lombada.ui.main.DuelRoute
import io.github.guilhermetelles.lombada.ui.main.MovieRoute
import io.github.guilhermetelles.lombada.ui.main.ScreenContext
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import io.github.guilhermetelles.lombada.ui.theme.RankSticker
import kotlinx.coroutines.launch

/**
 * Duelo entre duas entradas da lista. Ponto de entrada do pacote, registrado no `MainScreen`.
 *
 * @param context Lista, pessoa logada e navegação.
 * @param route Argumentos da rota.
 */
@Composable
fun DuelEntry(context: ScreenContext, route: DuelRoute) {
    val container = appContainer()
    val listState by context.listViewModel.state.collectAsStateWithLifecycle()
    // O par fica fixo depois de escolhido, mesmo que a lista mude com a tela aberta.
    var chosen by rememberSaveable { mutableStateOf<List<String>?>(null) }

    LaunchedEffect(listState.loading) {
        if (listState.loading || chosen != null) return@LaunchedEffect
        val ranking = listState.ranking
        val fromRoute =
            if (route.entryIdA != null &&
                route.entryIdB != null
            ) {
                DuelPair.ofIds(ranking, route.entryIdA, route.entryIdB)
            } else {
                null
            }
        val pair = fromRoute ?: DuelPair.ofDay(ranking, BrazilDay.today())
        chosen = pair?.let { listOf(it.first.id, it.second.id) } ?: emptyList()
    }

    val ids = chosen
    val pair = ids?.takeIf { it.size == 2 }?.let { DuelPair.ofIds(listState.ranking, it[0], it[1]) }

    ScreenColumn(title = "Duelo de revisão", onBack = context.back) {
        when {
            ids == null -> LoadingBlock()

            pair == null ->
                EmptyState("Faltam filmes", "O duelo precisa de pelo menos dois filmes na lista.")

            else -> {
                val (top, bottom) = pair
                Text(
                    "Vocês ainda acham que ${Formatting.shortTitle(top.movie.title)} é melhor que " +
                        "${Formatting.shortTitle(bottom.movie.title)}?",
                    style = MaterialTheme.typography.headlineSmall.copy(fontSize = 24.sp, lineHeight = 30.sp),
                    modifier = Modifier.padding(horizontal = 20.dp).semantics { heading() }
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 20.dp)
                ) {
                    listOf(top, bottom).forEach { entry ->
                        Side(entry, listState.positions[entry.id], Modifier.weight(1f)) {
                            context.navigate(
                                MovieRoute(entry.tmdbId, entry.movie.title, entry.movie.year, entry.movie.posterPath)
                            )
                        }
                    }
                }
                Column(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 24.dp)
                ) {
                    DuelButton("Sim, manter", Icons.Filled.Check, filled = false) {
                        context.back()
                        message(container, "${Formatting.shortTitle(top.movie.title)} continua na frente")
                    }
                    DuelButton("Não, trocar a ordem", Icons.Filled.SwapVert, filled = true) {
                        swap(container, context, listState.ranking, top, bottom, listState.positions[top.id])
                    }
                }
                Text(
                    "Um par de vizinhos no ranking por dia, para revisar a lista aos poucos. Tocar num filme abre a página dele.",
                    style = MaterialTheme.typography.bodySmall,
                    color = LombadaColors.Paper3,
                    modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 16.dp)
                )
            }
        }
    }
}

// Troca as duas entradas de lugar no ranking, volta para a tela anterior e oferece "Desfazer",
// que devolve as chaves antigas.
private fun swap(
    container: AppContainer,
    context: ScreenContext,
    ranking: List<Entry>,
    top: Entry,
    bottom: Entry,
    topPosition: Int?
) {
    // Chaves iguais (duas adições ao mesmo tempo) não deixam pôr uma entre as outras: avisa em vez de fechar o app.
    val keys =
        runCatching { DuelPair.swapKeys(ranking, top.id, bottom.id) }.getOrElse {
            message(
                container,
                "Não deu para trocar agora: as posições estão empatadas. Arraste um dos filmes na lista."
            )
            return
        } ?: return
    val old = ranking.filter { it.id in keys }.associate { it.id to it.rankKey }
    keys.forEach { (id, key) ->
        container.entries.move(context.list.id, id, key, context.uid)
        context.listViewModel.recordEvent(ListEventType.Moved, id)
    }
    context.back()
    container.appScope.launch {
        val text =
            topPosition?.let { "${Formatting.shortTitle(bottom.movie.title)} passou para #$it" }
                ?: "${Formatting.shortTitle(bottom.movie.title)} passou na frente"
        val result = container.snackbar.showSnackbar(text, actionLabel = "Desfazer", duration = SnackbarDuration.Long)
        if (result == SnackbarResult.ActionPerformed) {
            old.forEach { (id, key) -> container.entries.move(context.list.id, id, key, context.uid) }
        }
    }
}

private fun message(container: AppContainer, text: String) {
    container.appScope.launch { container.snackbar.showSnackbar(text) }
}

@Composable
private fun Side(entry: Entry, position: Int?, modifier: Modifier = Modifier, onOpen: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier =
            modifier
                .clickable(role = Role.Button, onClick = onOpen)
                .padding(8.dp)
                .semantics(mergeDescendants = true) {}
    ) {
        Box {
            MovieCover(entry.movie.title, entry.movie.posterPath, entry.tmdbId, Modifier.fillMaxWidth())
            if (position != null) RankSticker(position, entry.id, Modifier.offset(x = (-6).dp, y = (-6).dp))
        }
        Text(
            Formatting.shortTitle(entry.movie.title),
            style = MaterialTheme.typography.titleMedium,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 10.dp)
        )
        val meta =
            listOfNotNull(entry.movie.year?.toString(), entry.watchedOn?.let { "visto em ${Formatting.shortDate(it)}" })
        if (meta.isNotEmpty()) {
            Text(
                meta.joinToString(" · "),
                style = MaterialTheme.typography.bodySmall,
                color = LombadaColors.Paper3,
                textAlign = TextAlign.Center
            )
        }
        if (entry.comment.isNotBlank()) {
            Text(
                "“${entry.comment}”",
                style = MaterialTheme.typography.bodySmall,
                color = LombadaColors.Paper2,
                maxLines = 4,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 6.dp)
            )
        }
    }
}

@Composable
private fun DuelButton(text: String, icon: ImageVector, filled: Boolean, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        colors =
            ButtonDefaults.buttonColors(
                containerColor = if (filled) LombadaColors.PosterOrange else LombadaColors.Tonal,
                contentColor = if (filled) LombadaColors.OnOrange else LombadaColors.Paper
            ),
        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)
    ) {
        Icon(icon, contentDescription = null)
        Text(text, modifier = Modifier.padding(start = 8.dp))
    }
}
