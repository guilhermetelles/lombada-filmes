package io.github.guilhermetelles.lombada.ui.advsearch

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
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Key
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.InputChip
import androidx.compose.material3.InputChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.guilhermetelles.lombada.data.model.DiscoverItem
import io.github.guilhermetelles.lombada.domain.DiscoverFilters
import io.github.guilhermetelles.lombada.domain.DiscoverKeywords
import io.github.guilhermetelles.lombada.domain.DiscoverResults
import io.github.guilhermetelles.lombada.domain.FilterGroup
import io.github.guilhermetelles.lombada.domain.FilterOption
import io.github.guilhermetelles.lombada.domain.Formatting
import io.github.guilhermetelles.lombada.domain.Keyword
import io.github.guilhermetelles.lombada.domain.RecsLines
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.components.LombadaButton
import io.github.guilhermetelles.lombada.ui.components.LombadaButtonStyle
import io.github.guilhermetelles.lombada.ui.components.LombadaTextField
import io.github.guilhermetelles.lombada.ui.components.MovieCover
import io.github.guilhermetelles.lombada.ui.main.MovieRoute
import io.github.guilhermetelles.lombada.ui.main.ScreenContext
import io.github.guilhermetelles.lombada.ui.recs.CompatLine
import io.github.guilhermetelles.lombada.ui.recs.LombadaFilterChip
import io.github.guilhermetelles.lombada.ui.recs.NoticeCard
import io.github.guilhermetelles.lombada.ui.recs.RecBadge
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import io.github.guilhermetelles.lombada.ui.theme.RankSticker
import kotlin.math.roundToInt

/**
 * Busca avançada, aberta pela busca da lista e pela aba Sugestões: texto livre interpretado pelo
 * IA em filtros e palavras-chave que substituem os já ligados (mostrados como chips que dá para
 * tirar), os grupos de filtros, o seletor de ordem e os resultados do TMDb na ordem do backend
 * (mais palavras-chave primeiro, depois a relevância ou a compatibilidade), com os filmes da lista
 * marcados com a posição. Cada resultado abre
 * a página do filme. Ponto de entrada do pacote, registrado no `MainScreen`.
 *
 * @param context Lista, pessoa logada e navegação.
 */
@Composable
fun AdvancedSearchEntry(context: ScreenContext) {
    val container = appContainer()
    val listId = context.list.id
    val viewModel = viewModel(key = "advsearch-$listId") { AdvancedSearchViewModel(container, listId) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val listState by context.listViewModel.state.collectAsStateWithLifecycle()
    val hasFilters = DiscoverFilters.active(state.filters).isNotEmpty()

    LazyColumn(
        modifier =
            Modifier
                .fillMaxSize()
                .background(LombadaColors.Ground)
                .statusBarsPadding()
                .navigationBarsPadding(),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        item {
            TopBar(showClear = state.hasAnything, onBack = context.back, onClear = viewModel::clear)
        }
        item {
            FreeText(
                text = state.text,
                interpreting = state.interpreting,
                onTextChange = viewModel::onTextChange,
                onInterpret = viewModel::interpret
            )
        }
        state.notice?.let { notice ->
            item {
                Text(
                    notice,
                    style = MaterialTheme.typography.bodyMedium,
                    color = LombadaColors.Paper2,
                    modifier =
                        Modifier
                            .padding(start = 20.dp, end = 20.dp, top = 12.dp)
                            .fillMaxWidth()
                            .background(LombadaColors.Shelf, MaterialTheme.shapes.medium)
                            .padding(14.dp)
                            .semantics { liveRegion = LiveRegionMode.Polite }
                )
            }
        }
        if (state.interpretedText != null && (hasFilters || state.keywords.isNotEmpty())) {
            item {
                Understood(
                    explanation = state.explanation,
                    active = DiscoverFilters.active(state.filters),
                    keywords = state.keywords,
                    onRemove = viewModel::toggle,
                    onRemoveKeyword = viewModel::removeKeyword
                )
            }
        }
        items(FilterGroup.entries, key = { it.name }) { group ->
            FilterGroupRow(group, DiscoverFilters.selected(state.filters, group), onToggle = viewModel::toggle)
        }
        item {
            FitSwitch(
                checked = state.filters.fit,
                onToggle = { viewModel.toggle(FilterOption(null, "fit", DiscoverFilters.FIT_LABEL)) }
            )
        }
        item { DiscoverSortBar(state.sort, onSortChange = viewModel::setSort) }
        item {
            val count =
                if (state.loading) {
                    "Buscando…"
                } else {
                    "${Formatting.count(
                        state.results.size,
                        "filme",
                        "filmes"
                    )} ${DiscoverFilters.filtersLabel(state.filters, state.keywords.size)}, " +
                        state.sort.summary
                }
            Text(
                count,
                style = MaterialTheme.typography.titleSmall,
                modifier =
                    Modifier
                        .padding(start = 20.dp, end = 20.dp, top = 20.dp, bottom = 4.dp)
                        .semantics {
                            heading()
                            liveRegion = LiveRegionMode.Polite
                        }
            )
        }
        when {
            state.loading ->
                item {
                    Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = LombadaColors.Sticker)
                    }
                }

            state.results.isEmpty() && state.error != null ->
                item { SearchError(state.error.orEmpty(), onRetry = viewModel::retry) }

            state.results.isEmpty() ->
                item {
                    NoticeCard(
                        "Nenhum filme com tudo isso",
                        "Tire um ou dois filtros para ver mais filmes.",
                        Modifier.padding(start = 20.dp, end = 20.dp, top = 8.dp)
                    )
                }

            else -> {
                items(state.results, key = { it.tmdbId }) { item ->
                    ResultRow(
                        item = item,
                        position = DiscoverResults.position(item, listState.positions),
                        matched = DiscoverKeywords.matchedLine(state.keywords, item.matchedKeywords),
                        onOpen = { context.navigate(MovieRoute(item.tmdbId, item.title, item.year, item.posterPath)) }
                    )
                }
                if (state.error != null) {
                    item { SearchError(state.error.orEmpty(), onRetry = viewModel::loadMore) }
                } else if (state.canLoadMore) {
                    item {
                        LombadaButton(
                            "Carregar mais",
                            onClick = viewModel::loadMore,
                            style = LombadaButtonStyle.Tonal,
                            busy = state.loadingMore,
                            modifier = Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 12.dp)
                        )
                    }
                }
            }
        }
        item {
            Text(
                "Filmes do TMDb no Brasil. Humores, temas e o que a frase cita viram gêneros e " +
                    "palavras-chave do TMDb; a compatibilidade vem do gosto aprendido com o ranking de vocês.",
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.5.sp, lineHeight = 19.sp),
                color = LombadaColors.Paper3,
                modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 24.dp)
            )
        }
    }
}

@Composable
private fun TopBar(showClear: Boolean, onBack: () -> Unit, onClear: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 4.dp)
    ) {
        IconButton(onClick = onBack) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
        }
        Text(
            "Busca avançada",
            style = MaterialTheme.typography.titleLarge.copy(fontSize = 18.sp),
            modifier = Modifier.padding(start = 4.dp).weight(1f).semantics { heading() }
        )
        if (showClear) LombadaButton("Limpar tudo", onClick = onClear, style = LombadaButtonStyle.Text)
    }
}

@Composable
private fun FreeText(text: String, interpreting: Boolean, onTextChange: (String) -> Unit, onInterpret: () -> Unit) {
    val focusManager = LocalFocusManager.current
    val submit = {
        focusManager.clearFocus()
        onInterpret()
    }
    Column(modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 8.dp)) {
        LombadaTextField(
            value = text,
            onValueChange = onTextChange,
            label = "Descreva o que querem ver",
            placeholder = "Comédia curta dos anos 90, terror na Netflix…",
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { submit() })
        )
        LombadaButton(
            "Interpretar a frase",
            onClick = submit,
            busy = interpreting,
            enabled = text.trim().length >= 2,
            modifier = Modifier.fillMaxWidth().padding(top = 10.dp)
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Understood(
    explanation: String?,
    active: List<FilterOption>,
    keywords: List<Keyword>,
    onRemove: (FilterOption) -> Unit,
    onRemoveKeyword: (Keyword) -> Unit
) {
    Column(
        modifier =
            Modifier
                .padding(start = 20.dp, end = 20.dp, top = 12.dp)
                .fillMaxWidth()
                .background(LombadaColors.Shelf, MaterialTheme.shapes.large)
                .padding(14.dp)
                .semantics { liveRegion = LiveRegionMode.Polite }
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(
                Icons.Filled.AutoAwesome,
                contentDescription = null,
                tint = LombadaColors.Sticker,
                modifier = Modifier.size(18.dp)
            )
            Text("A IA entendeu", style = MaterialTheme.typography.titleSmall)
        }
        explanation?.let {
            Text(
                it,
                style = MaterialTheme.typography.bodyMedium,
                color = LombadaColors.Paper2,
                modifier = Modifier.padding(top = 6.dp)
            )
        }
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(top = 8.dp)
        ) {
            active.forEach { option ->
                val label = option.group?.let { "${it.title}: ${option.label}" } ?: option.label
                InputChip(
                    selected = true,
                    onClick = { onRemove(option) },
                    label = { Text(label) },
                    trailingIcon = {
                        Icon(Icons.Filled.Close, contentDescription = "Tirar", modifier = Modifier.size(18.dp))
                    },
                    colors =
                        InputChipDefaults.inputChipColors(
                            selectedContainerColor = LombadaColors.Tonal,
                            selectedLabelColor = LombadaColors.Paper,
                            selectedTrailingIconColor = LombadaColors.Paper2
                        ),
                    modifier = Modifier.heightIn(min = 48.dp)
                )
            }
            keywords.forEach { keyword -> KeywordChip(keyword, onRemove = { onRemoveKeyword(keyword) }) }
        }
        Text(
            "Toque num filtro ou numa palavra-chave para tirar; os grupos abaixo mostram os filtros ligados.",
            style = MaterialTheme.typography.bodySmall,
            color = LombadaColors.Paper3,
            modifier = Modifier.padding(top = 4.dp)
        )
    }
}

@Composable
private fun KeywordChip(keyword: Keyword, onRemove: () -> Unit) {
    InputChip(
        selected = true,
        onClick = onRemove,
        label = { Text(keyword.label) },
        leadingIcon = {
            Icon(Icons.Filled.Key, contentDescription = "Palavra-chave", modifier = Modifier.size(18.dp))
        },
        trailingIcon = {
            Icon(Icons.Filled.Close, contentDescription = "Tirar", modifier = Modifier.size(18.dp))
        },
        colors =
            InputChipDefaults.inputChipColors(
                selectedContainerColor = LombadaColors.Tonal,
                selectedLabelColor = LombadaColors.Paper,
                selectedLeadingIconColor = LombadaColors.Sticker,
                selectedTrailingIconColor = LombadaColors.Paper2
            ),
        modifier = Modifier.heightIn(min = 48.dp)
    )
}

@Composable
private fun FilterGroupRow(group: FilterGroup, selected: List<String>, onToggle: (FilterOption) -> Unit) {
    Column(modifier = Modifier.padding(top = 16.dp)) {
        Text(
            group.title,
            style = MaterialTheme.typography.labelLarge,
            color = LombadaColors.Paper2,
            modifier = Modifier.padding(horizontal = 20.dp).semantics { heading() }
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier =
                Modifier
                    .padding(top = 4.dp)
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp)
        ) {
            DiscoverFilters.options(group).forEach { option ->
                LombadaFilterChip(option.label, selected = option.id in selected, onClick = { onToggle(option) })
            }
        }
    }
}

@Composable
private fun FitSwitch(checked: Boolean, onToggle: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier =
            Modifier
                .padding(top = 16.dp)
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .clickable(role = Role.Switch, onClick = onToggle)
                .padding(horizontal = 20.dp)
                .semantics(mergeDescendants = true) { stateDescription = if (checked) "Ligado" else "Desligado" }
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(DiscoverFilters.FIT_LABEL, style = MaterialTheme.typography.titleSmall)
            Text(
                "Compatibilidade de ${DiscoverFilters.FIT_MIN_SCORE}% ou mais",
                style = MaterialTheme.typography.bodySmall,
                color = LombadaColors.Paper3
            )
        }
        Spacer(Modifier.width(12.dp))
        Switch(
            checked = checked,
            onCheckedChange = null,
            colors =
                SwitchDefaults.colors(
                    checkedThumbColor = LombadaColors.StickerInk,
                    checkedTrackColor = LombadaColors.Sticker,
                    uncheckedThumbColor = LombadaColors.Paper3,
                    uncheckedTrackColor = LombadaColors.ShelfHigh,
                    uncheckedBorderColor = LombadaColors.Rule
                )
        )
    }
}

@Composable
private fun ResultRow(item: DiscoverItem, position: Int?, matched: String?, onOpen: () -> Unit) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(role = Role.Button, onClickLabel = "Abrir ${item.title}", onClick = onOpen)
                .padding(horizontal = 20.dp, vertical = 8.dp)
                .semantics(mergeDescendants = true) {}
    ) {
        Box {
            MovieCover(item.title, item.posterPath, item.tmdbId, Modifier.width(60.dp), initialsSize = 14.sp)
            if (position != null && item.inListEntryId != null) {
                Box(Modifier.padding(start = 2.dp, top = 2.dp)) {
                    RankSticker(position = position, id = item.inListEntryId, size = 24.dp)
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.weight(1f)) {
            Text(
                buildAnnotatedString {
                    append(item.title)
                    item.year?.let {
                        withStyle(SpanStyle(color = LombadaColors.Paper3, fontWeight = FontWeight.Normal)) {
                            append("  $it")
                        }
                    }
                },
                style = MaterialTheme.typography.titleSmall.copy(fontSize = 15.5.sp)
            )
            Badges(position, item.trending)
            CompatLine(item.score.roundToInt(), meterWidth = 48.dp)
            RecsLines.meta(null, item.runtime, item.genres).takeIf { it.isNotEmpty() }?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = LombadaColors.Paper3)
            }
            matched?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = LombadaColors.Paper3) }
            if (position == null && item.reason.isNotBlank()) {
                Text(item.reason.trim(), style = MaterialTheme.typography.bodySmall, color = LombadaColors.Paper2)
            }
        }
    }
}

@Composable
private fun Badges(position: Int?, trending: Boolean) {
    if (position == null && !trending) return
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        position?.let { RecBadge("#$it na lista", highlight = true) }
        if (trending) RecBadge("Em alta")
    }
}

@Composable
private fun SearchError(message: String, onRetry: () -> Unit) {
    Column(
        modifier =
            Modifier
                .padding(start = 20.dp, end = 20.dp, top = 8.dp)
                .fillMaxWidth()
                .background(LombadaColors.Shelf, MaterialTheme.shapes.large)
                .padding(20.dp)
    ) {
        Text(message, style = MaterialTheme.typography.titleSmall)
        LombadaButton("Tentar de novo", onClick = onRetry, style = LombadaButtonStyle.Text)
    }
}
