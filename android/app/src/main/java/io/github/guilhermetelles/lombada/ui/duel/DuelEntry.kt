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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.guilhermetelles.lombada.data.model.Duel
import io.github.guilhermetelles.lombada.data.model.DuelChoice
import io.github.guilhermetelles.lombada.data.model.DuelStatus
import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.MovieList
import io.github.guilhermetelles.lombada.domain.Formatting
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

/**
 * Duelo de revisão: o par do dia, gravado pelo backend, e o voto de cada membro. A ordem só muda
 * quando todos votam para trocar; um voto para manter fecha o duelo. Ponto de entrada do pacote,
 * registrado no `MainScreen`.
 *
 * @param context Lista, pessoa logada e navegação.
 * @param route Argumentos da rota (o par da notificação, usado se o duelo de hoje ainda não existe).
 */
@Composable
fun DuelEntry(context: ScreenContext, route: DuelRoute) {
    val container = appContainer()
    val listState by context.listViewModel.state.collectAsStateWithLifecycle()
    val viewModel =
        viewModel(key = "duel-${context.list.id}") {
            DuelViewModel(container, context.list.id, route.entryIdA, route.entryIdB)
        }
    val state by viewModel.state.collectAsStateWithLifecycle()

    ScreenColumn(title = "Duelo de revisão", onBack = context.back) {
        val duel = state.duel
        when {
            state.loading || listState.loading -> LoadingBlock()

            state.loadError == DuelLoadError.NO_FILMS ->
                EmptyState("Faltam filmes", "O duelo precisa de pelo menos dois filmes na lista.")

            state.loadError != null || duel == null ->
                EmptyState(
                    "Não deu para abrir o duelo",
                    if (state.loadError == DuelLoadError.NETWORK) {
                        "Sem internet. Confira a conexão e tente de novo."
                    } else {
                        "Tente de novo em instantes."
                    },
                    actionLabel = "Tentar de novo",
                    onAction = viewModel::open
                )

            else -> {
                val first = listState.ranking.firstOrNull { it.id == duel.entryIdA }
                val second = listState.ranking.firstOrNull { it.id == duel.entryIdB }
                if (first == null || second == null) {
                    EmptyState(
                        "Um dos filmes saiu da lista",
                        "O duelo de hoje não vale mais. Amanhã tem outro par."
                    )
                } else {
                    DuelBody(context, duel, first, second, listState.positions, state.sending, viewModel::vote)
                }
            }
        }
    }
}

@Composable
private fun DuelBody(
    context: ScreenContext,
    duel: Duel,
    first: Entry,
    second: Entry,
    positions: Map<String, Int>,
    sending: DuelChoice?,
    onVote: (DuelChoice) -> Unit
) {
    val titleA = Formatting.shortTitle(first.movie.title)
    val titleB = Formatting.shortTitle(second.movie.title)
    Text(
        "Vocês ainda acham que $titleA é melhor que $titleB?",
        style = MaterialTheme.typography.headlineSmall.copy(fontSize = 24.sp, lineHeight = 30.sp),
        modifier = Modifier.padding(horizontal = 20.dp).semantics { heading() }
    )
    Row(
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 20.dp)
    ) {
        // Na ordem atual do ranking, que depois da troca já mostra B na frente.
        val pair = listOf(first, second).sortedBy { positions[it.id] ?: Int.MAX_VALUE }
        pair.forEach { entry ->
            Side(entry, positions[entry.id], Modifier.weight(1f)) {
                context.navigate(MovieRoute(entry.tmdbId, entry.movie.title, entry.movie.year, entry.movie.posterPath))
            }
        }
    }
    Votes(context.list, context.uid, duel.votes)
    when (duel.status) {
        DuelStatus.OPEN -> {
            val mine = duel.votes[context.uid]
            Column(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 24.dp)
            ) {
                DuelButton("Sim, manter", Icons.Filled.Check, filled = false, enabled = sending == null) {
                    onVote(DuelChoice.KEEP)
                }
                DuelButton(
                    if (mine == DuelChoice.SWAP) "Você votou para trocar" else "Não, trocar a ordem",
                    Icons.Filled.SwapVert,
                    filled = true,
                    enabled = sending == null && mine != DuelChoice.SWAP
                ) {
                    onVote(DuelChoice.SWAP)
                }
            }
        }

        DuelStatus.SWAPPED ->
            Result(
                positions[second.id]?.let { "Trocaram a ordem: $titleB passou para #$it" }
                    ?: "Trocaram a ordem: $titleB passou na frente"
            )

        DuelStatus.KEPT -> Result("Ficou como está: $titleA continua na frente")
    }
    Text(
        "Um par de vizinhos no ranking por dia, para revisar a lista aos poucos. A ordem só muda se " +
            "todos votarem para trocar; um voto para manter encerra o duelo. Tocar num filme abre a página dele.",
        style = MaterialTheme.typography.bodySmall,
        color = LombadaColors.Paper3,
        modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 16.dp)
    )
}

// Cada membro e o voto dele; a pessoa logada aparece como "Você".
@Composable
private fun Votes(list: MovieList, uid: String, votes: Map<String, DuelChoice>) {
    Column(
        verticalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 20.dp)
    ) {
        list.memberUids.forEach { member ->
            val name =
                if (member ==
                    uid
                ) {
                    "Você"
                } else {
                    list.memberProfiles[member]?.name?.takeIf { it.isNotBlank() } ?: "Alguém da lista"
                }
            val vote =
                when (votes[member]) {
                    DuelChoice.SWAP -> "quer trocar"
                    DuelChoice.KEEP -> "quer manter"
                    null -> "ainda não votou"
                }
            Row(modifier = Modifier.fillMaxWidth().semantics(mergeDescendants = true) {}) {
                Text(name, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                Text(
                    vote,
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (votes[member] == null) LombadaColors.Paper3 else LombadaColors.Paper
                )
            }
        }
    }
}

@Composable
private fun Result(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleMedium,
        modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 24.dp)
    )
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
private fun DuelButton(text: String, icon: ImageVector, filled: Boolean, enabled: Boolean, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = enabled,
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
