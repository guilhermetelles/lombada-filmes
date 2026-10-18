package io.github.guilhermetelles.lombada.ui.feed

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Cake
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Quiz
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SwapVert
import androidx.compose.material.icons.filled.Tv
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.guilhermetelles.lombada.data.model.FeedItem
import io.github.guilhermetelles.lombada.data.model.MovieList
import io.github.guilhermetelles.lombada.domain.BrazilDay
import io.github.guilhermetelles.lombada.domain.FeedFilter
import io.github.guilhermetelles.lombada.domain.FeedGroups
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.main.NotifySettingsRoute
import io.github.guilhermetelles.lombada.ui.main.ScreenContext
import io.github.guilhermetelles.lombada.ui.main.toRoute
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import java.time.Instant

/**
 * Atividade da lista, aberta pelo sino. Ponto de entrada do pacote, registrado no `MainScreen`.
 *
 * @param context Lista, pessoa logada e navegação.
 */
@Composable
fun FeedEntry(context: ScreenContext) {
    val container = appContainer()
    val list = context.list
    val viewModel = viewModel(key = "feed-${list.id}") { FeedViewModel(container, list.id, context.uid) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val today = BrazilDay.today()
    val groups = FeedGroups.group(state.items, state.filter, today)

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(LombadaColors.Ground)
                .statusBarsPadding()
    ) {
        ScreenTopBar("Atividade", onBack = context.back) {
            IconButton(onClick = { context.navigate(NotifySettingsRoute) }) {
                Icon(Icons.Filled.Settings, contentDescription = "Configurar notificações")
            }
        }
        LazyColumn(modifier = Modifier.fillMaxSize().navigationBarsPadding()) {
            item(key = "filters") { Filters(state.filter, viewModel::setFilter) }
            when {
                state.loading -> item(key = "loading") { LoadingBlock() }

                groups.isEmpty() ->
                    item(key = "empty") {
                        if (state.filter == FeedFilter.All) {
                            EmptyState(
                                "Nada por aqui ainda",
                                "O que vocês fizerem na lista, o quiz, as curiosidades e os lembretes do dia aparecem aqui."
                            )
                        } else {
                            EmptyState("Nada desse tipo ainda", "Quando chegar um aviso desse tipo, ele aparece aqui.")
                        }
                    }

                else ->
                    groups.forEach { group ->
                        item(key = "group-${group.label}") {
                            Text(
                                group.label,
                                style = MaterialTheme.typography.titleSmall,
                                color = LombadaColors.Paper3,
                                modifier =
                                    Modifier
                                        .padding(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 4.dp)
                                        .semantics { heading() }
                            )
                        }
                        items(group.items, key = { it.id }) { item ->
                            val route = item.route?.toRoute()
                            FeedRow(
                                item = item,
                                list = list,
                                unread = isUnread(item.createdAt, state.seenBefore),
                                time = FeedGroups.timeLabel(item.createdAt, today),
                                onClick = route?.let { { context.navigate(it) } }
                            )
                        }
                    }
            }
            item(key = "bottom") { Box(Modifier.padding(bottom = 24.dp)) }
        }
    }
}

private fun isUnread(createdAt: Instant?, seenBefore: Instant?): Boolean =
    seenBefore != null && (createdAt == null || createdAt.isAfter(seenBefore))

@Composable
private fun Filters(selected: FeedFilter, onSelect: (FeedFilter) -> Unit) {
    LazyRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(horizontal = 20.dp),
        modifier = Modifier.padding(top = 4.dp)
    ) {
        items(FeedFilter.entries) { filter ->
            val on = filter == selected
            FilterChip(
                selected = on,
                onClick = { onSelect(filter) },
                label = { Text(filter.label) },
                leadingIcon =
                    if (on) {
                        { Icon(Icons.Filled.Check, contentDescription = null, modifier = Modifier.size(18.dp)) }
                    } else {
                        null
                    },
                colors =
                    FilterChipDefaults.filterChipColors(
                        selectedContainerColor = LombadaColors.Tonal,
                        selectedLabelColor = LombadaColors.Paper,
                        selectedLeadingIconColor = LombadaColors.Sticker,
                        labelColor = LombadaColors.Paper2
                    )
            )
        }
    }
}

@Composable
private fun FeedRow(item: FeedItem, list: MovieList, unread: Boolean, time: String, onClick: (() -> Unit)?) {
    Row(
        verticalAlignment = Alignment.Top,
        modifier =
            Modifier
                .fillMaxWidth()
                .then(if (onClick != null) Modifier.clickable(role = Role.Button, onClick = onClick) else Modifier)
                .background(if (unread) LombadaColors.Shelf else LombadaColors.Ground)
                .padding(horizontal = 20.dp, vertical = 12.dp)
                .semantics(mergeDescendants = true) { if (unread) stateDescription = "Novidade" }
    ) {
        val actor = item.actorUid?.let { memberProfile(list, it) }
        if (actor != null) {
            MemberAvatar(actor.name, actor.photoUrl, 40.dp)
        } else {
            Box(
                contentAlignment = Alignment.Center,
                modifier =
                    Modifier
                        .size(40.dp)
                        .background(LombadaColors.Tonal, CircleShape)
            ) {
                Icon(
                    iconFor(item),
                    contentDescription = null,
                    tint = LombadaColors.Sticker,
                    modifier = Modifier.size(22.dp)
                )
            }
        }
        Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
            Text(item.title, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.SemiBold))
            item.body?.takeIf { it.isNotBlank() }?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.bodyMedium,
                    color = LombadaColors.Paper2,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
            item.quote?.takeIf { it.isNotBlank() }?.let {
                // Comentário da dupla, verbatim.
                Text(
                    "“$it”",
                    style = MaterialTheme.typography.bodyMedium,
                    color = LombadaColors.Paper,
                    maxLines = 4,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
        if (time.isNotEmpty()) {
            Text(
                time,
                style = MaterialTheme.typography.labelSmall,
                color = LombadaColors.Paper3,
                modifier = Modifier.padding(start = 8.dp)
            )
        }
    }
}

private fun iconFor(item: FeedItem): ImageVector = when (item.type) {
    "quiz.winner" -> Icons.Filled.EmojiEvents

    "queue.added", "queue.removed" -> Icons.Filled.Bookmark

    "daily.retro" -> Icons.Filled.BarChart

    "daily.duel" -> Icons.Filled.SwapVert

    "daily.milestone" -> Icons.Filled.EmojiEvents

    "daily.release", "daily.releaseAnniversary" -> Icons.Filled.Movie

    "daily.streaming" -> Icons.Filled.Tv

    "daily.birthday" -> Icons.Filled.Cake

    else ->
        when (item.kind) {
            "lista" -> Icons.AutoMirrored.Filled.List
            "quiz" -> Icons.Filled.Quiz
            "curiosidade" -> Icons.Filled.AutoAwesome
            else -> Icons.Filled.Notifications
        }
}
