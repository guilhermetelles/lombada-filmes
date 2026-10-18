package io.github.guilhermetelles.lombada.ui.queue

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import io.github.guilhermetelles.lombada.data.model.MemberProfile
import io.github.guilhermetelles.lombada.domain.BrazilDay
import io.github.guilhermetelles.lombada.domain.Formatting
import io.github.guilhermetelles.lombada.domain.QueueLines
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.components.LombadaButton
import io.github.guilhermetelles.lombada.ui.components.LombadaButtonStyle
import io.github.guilhermetelles.lombada.ui.components.MovieCover
import io.github.guilhermetelles.lombada.ui.components.initialsOf
import io.github.guilhermetelles.lombada.ui.main.MovieRoute
import io.github.guilhermetelles.lombada.ui.main.RecsRoute
import io.github.guilhermetelles.lombada.ui.main.RouletteRoute
import io.github.guilhermetelles.lombada.ui.main.ScreenContext
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map

/**
 * Aba "Quero ver": o sorteio "O que vamos ver hoje?" no topo e a fila compartilhada, do mais
 * recente para o mais antigo. Cada filme abre a página dele; a lixeira tira da fila, com "Desfazer".
 *
 * @param context Lista, pessoa logada e navegação.
 */
@Composable
fun QueueEntry(context: ScreenContext) {
    val container = appContainer()
    val listId = context.list.id
    val viewModel =
        viewModel(key = "queue-$listId") {
            val inList = context.listViewModel.state.map { it.entryByTmdbId.keys }.distinctUntilChanged()
            QueueViewModel(container, listId, inList)
        }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val today = remember { BrazilDay.today() }

    LazyColumn(
        modifier =
            Modifier
                .fillMaxSize()
                .background(LombadaColors.Ground)
                .statusBarsPadding(),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        item {
            Column(modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 16.dp)) {
                Text(
                    "Quero ver",
                    style = MaterialTheme.typography.headlineSmall,
                    modifier = Modifier.semantics { heading() }
                )
                Text(
                    "Os filmes que vocês querem ver juntos. Toque num filme para abrir a página dele.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = LombadaColors.Paper2,
                    modifier = Modifier.padding(top = 4.dp)
                )
                LombadaButton(
                    "O que vamos ver hoje?",
                    onClick = { context.navigate(RouletteRoute) },
                    modifier = Modifier.fillMaxWidth().padding(top = 16.dp)
                )
                if (!state.loading) {
                    Text(
                        if (state.rows.isNotEmpty()) {
                            "Sorteia um destes ${Formatting.count(
                                state.rows.size,
                                "filme",
                                "filmes"
                            )}, com filtros rápidos."
                        } else {
                            "A fila está vazia: o sorteio usa as sugestões."
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = LombadaColors.Paper3,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
            }
        }
        when {
            state.loading ->
                item {
                    Box(Modifier.fillMaxWidth().padding(48.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = LombadaColors.Sticker)
                    }
                }

            state.rows.isEmpty() -> item { EmptyQueue() }

            else -> {
                item {
                    Column(modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 28.dp, bottom = 8.dp)) {
                        Text(
                            "${Formatting.count(state.rows.size, "filme", "filmes")} na fila",
                            style = MaterialTheme.typography.titleMedium.copy(fontSize = 18.sp),
                            modifier = Modifier.semantics { heading() }
                        )
                        Text(
                            "O mais recente primeiro, com quem pediu e onde assistir.",
                            style = MaterialTheme.typography.bodySmall,
                            color = LombadaColors.Paper3
                        )
                    }
                }
                items(state.rows, key = { it.item.tmdbId }) { row ->
                    QueueItemRow(
                        row = row,
                        requester = QueueLines.requester(row.item, context.uid, context.list.memberProfiles, today),
                        requesterProfile = context.list.memberProfiles[row.item.addedBy],
                        onOpen = {
                            context.navigate(
                                MovieRoute(
                                    row.item.tmdbId,
                                    row.movie?.title.orEmpty(),
                                    row.movie?.year,
                                    row.movie?.posterPath
                                )
                            )
                        },
                        onRemove = { viewModel.remove(row) }
                    )
                }
            }
        }
        item {
            LombadaButton(
                "Ver sugestões para vocês",
                onClick = { context.navigate(RecsRoute) },
                style = LombadaButtonStyle.Tonal,
                modifier = Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 20.dp)
            )
        }
    }
}

@Composable
private fun EmptyQueue() {
    Column(
        modifier =
            Modifier
                .padding(start = 20.dp, end = 20.dp, top = 28.dp)
                .fillMaxWidth()
                .background(LombadaColors.Shelf, MaterialTheme.shapes.large)
                .padding(20.dp)
    ) {
        Text("Nada na fila ainda", style = MaterialTheme.typography.titleMedium)
        Text(
            "Toque em \"Quero ver\" na página de um filme ou numa sugestão.",
            style = MaterialTheme.typography.bodyMedium,
            color = LombadaColors.Paper2,
            modifier = Modifier.padding(top = 4.dp)
        )
    }
}

@Composable
private fun QueueItemRow(
    row: QueueRow,
    requester: String,
    requesterProfile: MemberProfile?,
    onOpen: () -> Unit,
    onRemove: () -> Unit
) {
    val movie = row.movie
    val title = movie?.title ?: "Carregando…"
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(start = 20.dp, end = 8.dp, top = 6.dp, bottom = 6.dp)
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            modifier =
                Modifier
                    .weight(1f)
                    .clickable(role = Role.Button, onClickLabel = "Abrir $title", onClick = onOpen)
                    .semantics(mergeDescendants = true) {}
        ) {
            MovieCover(title, movie?.posterPath, row.item.tmdbId, Modifier.width(56.dp), initialsSize = 14.sp)
            Column(verticalArrangement = Arrangement.spacedBy(3.dp), modifier = Modifier.weight(1f)) {
                Text(
                    buildAnnotatedString {
                        append(title)
                        movie?.year?.let {
                            withStyle(SpanStyle(color = LombadaColors.Paper3, fontWeight = FontWeight.Normal)) {
                                append("  $it")
                            }
                        }
                    },
                    style = MaterialTheme.typography.titleSmall.copy(fontSize = 15.5.sp)
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    MemberDot(requesterProfile, 20.dp)
                    Text(requester, style = MaterialTheme.typography.bodySmall, color = LombadaColors.Paper2)
                }
                QueueLines.where(movie?.providersBR?.flatrate)?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = LombadaColors.Paper3)
                }
            }
        }
        IconButton(onClick = onRemove) {
            Icon(Icons.Filled.Delete, contentDescription = "Tirar $title da fila", tint = LombadaColors.Paper2)
        }
    }
}

/**
 * Foto redonda de um membro, com as iniciais quando não há foto.
 *
 * @param profile Nome e foto; null mostra um círculo vazio.
 * @param size Diâmetro.
 */
@Composable
fun MemberDot(profile: MemberProfile?, size: Dp) {
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            Modifier
                .size(size)
                .clip(CircleShape)
                .background(LombadaColors.Tonal)
    ) {
        profile?.name?.takeIf { it.isNotBlank() }?.let {
            Text(
                initialsOf(it).take(1),
                style = MaterialTheme.typography.labelSmall.copy(fontSize = (size.value * 0.45f).sp),
                color = LombadaColors.Paper
            )
        }
        profile?.photoUrl?.let {
            AsyncImage(it, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.size(size))
        }
    }
}
