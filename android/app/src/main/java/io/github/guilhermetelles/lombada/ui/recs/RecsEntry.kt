package io.github.guilhermetelles.lombada.ui.recs

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.guilhermetelles.lombada.domain.Formatting
import io.github.guilhermetelles.lombada.domain.RecKindFilter
import io.github.guilhermetelles.lombada.domain.RecsLines
import io.github.guilhermetelles.lombada.domain.Reports
import io.github.guilhermetelles.lombada.domain.TasteProfile
import io.github.guilhermetelles.lombada.domain.TasteTrait
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.components.LombadaButton
import io.github.guilhermetelles.lombada.ui.components.LombadaButtonStyle
import io.github.guilhermetelles.lombada.ui.main.AdvancedSearchRoute
import io.github.guilhermetelles.lombada.ui.main.MovieRoute
import io.github.guilhermetelles.lombada.ui.main.PersonRoute
import io.github.guilhermetelles.lombada.ui.main.QueueRoute
import io.github.guilhermetelles.lombada.ui.main.ScreenContext
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import java.time.Instant
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map

// Horário da rotina recs (08:00 UTC) em Brasília, para os estados vazios.
private const val NEXT_UPDATE = "todo dia às 5h"

/**
 * Aba Sugestões: o perfil de gosto calculado no app, "Em alta para vocês" e as sugestões de
 * `recs/current`, com filtro por tipo, "Quero ver" e "Não quero". Cada filme abre a página dele.
 * Ponto de entrada do pacote, registrado no `MainScreen`.
 *
 * @param context Lista, pessoa logada e navegação.
 */
@Composable
fun RecsEntry(context: ScreenContext) {
    val container = appContainer()
    val listId = context.list.id
    val viewModel =
        viewModel(key = "recs-$listId") {
            val ranking = context.listViewModel.state.map { it.ranking to !it.loading }.distinctUntilChanged()
            RecsViewModel(container, listId, context.uid, ranking)
        }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val now = remember(state.computedAt) { Instant.now() }
    val open: (RecRow) -> Unit = { row ->
        context.navigate(MovieRoute(row.item.tmdbId, row.item.title, row.item.year, row.item.posterPath))
    }

    LazyColumn(
        modifier =
            Modifier
                .fillMaxSize()
                .background(LombadaColors.Ground)
                .statusBarsPadding(),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        item {
            Header(
                updated = state.computedAt?.let { RecsLines.updatedLabel(it, now) },
                queueCount = state.queueCount,
                onAdvanced = { context.navigate(AdvancedSearchRoute) },
                onQueue = { context.navigate(QueueRoute) }
            )
        }
        when {
            state.loading ->
                item {
                    Box(Modifier.fillMaxWidth().padding(48.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = LombadaColors.Sticker)
                    }
                }

            state.films == 0 ->
                item {
                    NoticeCard(
                        "Comecem pela lista",
                        "Registrem os filmes que vocês já viram. As sugestões aparecem depois da próxima " +
                            "atualização, $NEXT_UPDATE.",
                        Modifier.padding(start = 20.dp, end = 20.dp, top = 24.dp)
                    )
                }

            else -> {
                if (!state.profile.isEmpty) {
                    item {
                        TasteSection(
                            profile = state.profile,
                            onOpenDirector = { trait ->
                                trait.personId?.let {
                                    context.navigate(PersonRoute(it, trait.label, department = "directing"))
                                }
                            }
                        )
                    }
                }
                if (state.films < RecsLines.SMALL_LIST) {
                    item {
                        NoticeCard(
                            "Lista pequena",
                            "Com menos de ${RecsLines.SMALL_LIST} filmes, as sugestões ainda acertam pouco. " +
                                "Quanto mais filmes no ranking, melhores elas ficam.",
                            Modifier.padding(start = 20.dp, end = 20.dp, top = 16.dp)
                        )
                    }
                }
                if (!state.hasRecs) {
                    item {
                        NoticeCard(
                            "Sugestões a caminho",
                            "As sugestões desta lista aparecem depois da próxima atualização, $NEXT_UPDATE.",
                            Modifier.padding(start = 20.dp, end = 20.dp, top = 16.dp)
                        )
                    }
                } else {
                    if (state.trending.isNotEmpty()) {
                        item {
                            TrendingSection(state.trending, onOpen = open, onWant = { viewModel.want(it.item) })
                        }
                    }
                    item {
                        ForYouHeader(
                            filters = state.filters,
                            filter = state.filter,
                            count = state.items.size,
                            onFilter = viewModel::setFilter
                        )
                    }
                    if (state.items.isEmpty()) {
                        item {
                            NoticeCard(
                                "Nenhuma sugestão nova",
                                "Vocês já registraram, puseram na fila ou recusaram todas as sugestões desta " +
                                    "atualização. A próxima chega amanhã às 5h.",
                                Modifier.padding(start = 20.dp, end = 20.dp, top = 8.dp)
                            )
                        }
                    }
                    items(state.items, key = { it.item.tmdbId }) { row ->
                        RecCard(
                            row = row,
                            onOpen = { open(row) },
                            onOpenOrigin = { origin ->
                                context.navigate(MovieRoute(origin.tmdbId, origin.title))
                            },
                            onWant = { viewModel.want(row.item) },
                            onDismiss = { viewModel.dismiss(row.item) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun Header(updated: String?, queueCount: Int, onAdvanced: () -> Unit, onQueue: () -> Unit) {
    Column(modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 16.dp)) {
        Text(
            "Sugestões",
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.semantics { heading() }
        )
        Text(
            "O que ver depois, a partir do ranking de vocês.",
            style = MaterialTheme.typography.bodyMedium,
            color = LombadaColors.Paper2,
            modifier = Modifier.padding(top = 4.dp)
        )
        updated?.let {
            Text(
                it,
                style = MaterialTheme.typography.bodySmall,
                color = LombadaColors.Paper3,
                modifier = Modifier.padding(top = 2.dp)
            )
        }
        Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(top = 12.dp)
        ) {
            LombadaButton("Busca avançada", onClick = onAdvanced, style = LombadaButtonStyle.Tonal)
            LombadaButton(
                if (queueCount > 0) "Quero ver ($queueCount)" else "Quero ver",
                onClick = onQueue,
                style = LombadaButtonStyle.Text
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TasteSection(profile: TasteProfile, onOpenDirector: (TasteTrait) -> Unit) {
    Column(
        modifier =
            Modifier
                .padding(start = 20.dp, end = 20.dp, top = 24.dp)
                .fillMaxWidth()
                .background(LombadaColors.Shelf, MaterialTheme.shapes.large)
                .padding(16.dp)
    ) {
        Text(
            "Perfil de gosto de vocês",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() }
        )
        Text(
            "Tirado dos ${Formatting.count(profile.films, "filme", "filmes")} da lista; os do topo pesam mais.",
            style = MaterialTheme.typography.bodySmall,
            color = LombadaColors.Paper3,
            modifier = Modifier.padding(top = 2.dp)
        )
        if (profile.genres.isNotEmpty()) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(top = 12.dp)
            ) {
                profile.genres.forEach { TraitPill(it) }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 12.dp)) {
            if (profile.decades.isNotEmpty()) {
                Fact("Décadas", profile.decades.joinToString(" · ") { "${it.label} (${it.count})" })
            }
            profile.averageMinutes?.let { Fact("Duração média", Reports.hours(it)) }
        }
        if (profile.directors.isNotEmpty()) {
            Text(
                "Diretores que voltam",
                style = MaterialTheme.typography.labelMedium,
                color = LombadaColors.Paper3,
                modifier = Modifier.padding(top = 12.dp)
            )
            Column {
                profile.directors.forEach { trait ->
                    Text(
                        buildAnnotatedString {
                            withStyle(SpanStyle(color = LombadaColors.Sticker, fontWeight = FontWeight.SemiBold)) {
                                append(trait.label)
                            }
                            withStyle(SpanStyle(color = LombadaColors.Paper2)) {
                                append(
                                    " · ${Formatting.count(trait.count, "filme", "filmes")}, " +
                                        "o melhor em #${trait.bestPosition}"
                                )
                            }
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .heightIn(min = 48.dp)
                                .clickable(
                                    role = Role.Button,
                                    onClickLabel = "Abrir ${trait.label}",
                                    onClick = { onOpenDirector(trait) }
                                ).padding(vertical = 14.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun TraitPill(trait: TasteTrait) {
    Text(
        buildAnnotatedString {
            append(trait.label)
            withStyle(SpanStyle(color = LombadaColors.Sticker, fontWeight = FontWeight.Bold)) {
                append("  ${trait.count}")
            }
        },
        style = MaterialTheme.typography.labelLarge,
        color = LombadaColors.Paper,
        modifier =
            Modifier
                .background(LombadaColors.Tonal, MaterialTheme.shapes.small)
                .padding(horizontal = 12.dp, vertical = 8.dp)
    )
}

@Composable
private fun Fact(label: String, value: String) {
    Text(
        buildAnnotatedString {
            withStyle(SpanStyle(color = LombadaColors.Paper3)) { append("$label: ") }
            append(value)
        },
        style = MaterialTheme.typography.bodyMedium,
        color = LombadaColors.Paper
    )
}

@Composable
private fun TrendingSection(rows: List<RecRow>, onOpen: (RecRow) -> Unit, onWant: (RecRow) -> Unit) {
    Column(modifier = Modifier.padding(top = 28.dp)) {
        Column(modifier = Modifier.padding(horizontal = 20.dp)) {
            Text(
                "Em alta para vocês",
                style = MaterialTheme.typography.titleMedium.copy(fontSize = 18.sp),
                modifier = Modifier.semantics { heading() }
            )
            Text(
                "Em alta e no cinema no Brasil, fora da lista, pela compatibilidade com o ranking.",
                style = MaterialTheme.typography.bodySmall,
                color = LombadaColors.Paper3
            )
        }
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(horizontal = 20.dp),
            modifier = Modifier.padding(top = 12.dp)
        ) {
            items(rows, key = { it.item.tmdbId }) { row ->
                TrendingCard(row, onOpen = { onOpen(row) }, onWant = { onWant(row) })
            }
        }
    }
}

@Composable
private fun ForYouHeader(
    filters: List<RecKindFilter>,
    filter: RecKindFilter,
    count: Int,
    onFilter: (RecKindFilter) -> Unit
) {
    Column(modifier = Modifier.padding(top = 28.dp, bottom = 4.dp)) {
        Column(modifier = Modifier.padding(horizontal = 20.dp)) {
            Text(
                "Para vocês",
                style = MaterialTheme.typography.titleMedium.copy(fontSize = 18.sp),
                modifier = Modifier.semantics { heading() }
            )
            Text(
                "${Formatting.count(count, "sugestão", "sugestões")}, da mais compatível para a menos.",
                style = MaterialTheme.typography.bodySmall,
                color = LombadaColors.Paper3
            )
        }
        if (filters.size > 1) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier =
                    Modifier
                        .padding(top = 8.dp)
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 20.dp)
            ) {
                filters.forEach { option ->
                    LombadaFilterChip(option.label, selected = option == filter, onClick = { onFilter(option) })
                }
            }
        }
    }
}
