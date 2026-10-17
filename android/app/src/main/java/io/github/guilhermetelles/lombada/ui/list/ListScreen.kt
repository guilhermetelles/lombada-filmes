package io.github.guilhermetelles.lombada.ui.list

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.guilhermetelles.lombada.data.backend.PersonSearchResult
import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.MovieList
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.search.SearchBar
import io.github.guilhermetelles.lombada.ui.search.SearchViewModel
import io.github.guilhermetelles.lombada.ui.search.searchResults
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import io.github.guilhermetelles.lombada.ui.theme.rememberReducedMotion
import kotlinx.coroutines.launch
import sh.calvin.reorderable.ReorderableItem
import sh.calvin.reorderable.rememberReorderableLazyListState

private const val SCROLL_BUTTON_THRESHOLD_DP = 600

/**
 * Tela da lista: cabeçalho, ordem, as fitas e os botões de topo e fim.
 *
 * @param list Lista ativa.
 * @param uid Pessoa logada.
 * @param onSwitchList Abre "Suas listas".
 * @param onOpenEntry Abre o detalhe do filme.
 * @param onSignOut Sair da conta.
 * @param onOpenPerson Abre a tela de uma pessoa achada na busca.
 */
@Composable
fun ListScreen(
    list: MovieList,
    uid: String,
    onSwitchList: () -> Unit,
    onOpenEntry: (Entry) -> Unit,
    onSignOut: () -> Unit,
    onOpenPerson: (PersonSearchResult) -> Unit = {}
) {
    val container = appContainer()
    val viewModel = viewModel(key = "list-${list.id}") { ListViewModel(container, list.id, uid) }
    val searchViewModel = viewModel(key = "search-${list.id}") { SearchViewModel(container, list.id) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val search by searchViewModel.state.collectAsStateWithLifecycle()
    val lazyState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val haptic = LocalHapticFeedback.current
    val reducedMotion = rememberReducedMotion()
    val focusManager = LocalFocusManager.current
    var expanded by rememberSaveable { mutableStateOf(setOf<String>()) }
    val dragEnabled = state.sortMode == SortMode.Ranking

    val reorderState =
        rememberReorderableLazyListState(lazyState) { from, to ->
            val fromKey = from.key as? String ?: return@rememberReorderableLazyListState
            val toKey = to.key as? String ?: return@rememberReorderableLazyListState
            viewModel.onDragMove(fromKey, toKey)
            haptic.performHapticFeedback(HapticFeedbackType.SegmentFrequentTick)
        }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .statusBarsPadding()
    ) {
        LazyColumn(
            state = lazyState,
            contentPadding = WindowInsets.navigationBars.asPaddingValues(),
            modifier = Modifier.fillMaxSize()
        ) {
            item(key = "topbar") { LombadaTopBar { AccountMenu(onSignOut) } }
            item(key = "title") { ListTitle(list.name, list.description, onSwitchList) }
            stickyHeader(key = "search") {
                SearchBar(search.query, searchViewModel::onQueryChange, searchViewModel::clear)
            }
            if (search.active) {
                searchResults(
                    state = search,
                    positions = state.positions,
                    tmdbIdsInList = state.entryByTmdbId,
                    preparingTmdbId = state.preparingTmdbId,
                    onOpenEntry = { entryId -> state.ranking.firstOrNull { it.id == entryId }?.let(onOpenEntry) },
                    onOpenPerson = onOpenPerson,
                    onPickMovie = { movie ->
                        val entryId = state.entryByTmdbId[movie.tmdbId]
                        val entry = state.ranking.firstOrNull { it.id == entryId }
                        if (entry != null) onOpenEntry(entry) else viewModel.startAdd(movie.tmdbId)
                    }
                )
                return@LazyColumn
            }
            item(key = "sort") { SortBar(state.sortMode, viewModel::setSortMode) }
            item(key = "meta") {
                ListMeta(state.ranking.size, state.sortMode, state.newestFirst, viewModel::toggleDateDirection)
            }
            when {
                state.loading -> item(key = "loading") { Loading() }

                state.ranking.isEmpty() -> item(key = "empty") { EmptyShelf() }

                else -> {
                    items(state.shown, key = { it.id }) { entry ->
                        ReorderableItem(reorderState, key = entry.id, enabled = dragEnabled) { dragging ->
                            val lift by animateDpAsState(if (dragging) 14.dp else 0.dp, label = "lift")
                            EntryRow(
                                entry = entry,
                                position = state.positions[entry.id] ?: 0,
                                total = state.ranking.size,
                                expanded = entry.id in expanded,
                                onToggleExpanded = {
                                    expanded =
                                        if (entry.id in expanded) expanded - entry.id else expanded + entry.id
                                },
                                onOpen = { onOpenEntry(entry) },
                                onEdit = { viewModel.openEditor(entry.id) },
                                stickOnAppear = entry.id == state.justAddedId,
                                onMove = if (dragEnabled) { delta -> viewModel.moveBy(entry.id, delta) } else null,
                                dragHandle =
                                    if (dragEnabled) {
                                        {
                                            DragHandleIcon(
                                                entry.movie.title,
                                                Modifier.draggableHandle(
                                                    onDragStarted = {
                                                        haptic.performHapticFeedback(
                                                            HapticFeedbackType.GestureThresholdActivate
                                                        )
                                                    },
                                                    onDragStopped = {
                                                        haptic.performHapticFeedback(HapticFeedbackType.GestureEnd)
                                                        viewModel.onDragStopped(entry.id)
                                                    }
                                                )
                                            )
                                        }
                                    } else {
                                        null
                                    },
                                modifier =
                                    Modifier
                                        .graphicsLayer { if (dragging && !reducedMotion) rotationZ = -1.2f }
                                        .shadow(lift, MaterialTheme.shapes.medium)
                            )
                        }
                    }
                    item(key = "end") {
                        HorizontalDivider(color = LombadaColors.Rule, modifier = Modifier.padding(bottom = 96.dp))
                    }
                }
            }
        }

        val buttons by rememberScrollButtons(lazyState)
        ScrollButtons(
            showTop = buttons.first && !search.active,
            showBottom = buttons.second && !search.active,
            onTop = {
                scope.launch { if (reducedMotion) lazyState.scrollToItem(0) else lazyState.animateScrollToItem(0) }
            },
            onBottom = {
                scope.launch {
                    val last = lazyState.layoutInfo.totalItemsCount - 1
                    if (reducedMotion) lazyState.scrollToItem(last) else lazyState.animateScrollToItem(last)
                }
            },
            modifier =
                Modifier
                    .align(Alignment.BottomEnd)
                    .navigationBarsPadding()
                    .padding(end = 16.dp, bottom = 16.dp)
        )
    }

    // Depois de adicionar: sai da busca, rola até a entrada nova e deixa a etiqueta colar.
    LaunchedEffect(state.justAddedId, state.shown.size) {
        val newId = state.justAddedId ?: return@LaunchedEffect
        searchViewModel.clear()
        focusManager.clearFocus()
        val index = state.shown.indexOfFirst { it.id == newId }
        if (index < 0) return@LaunchedEffect
        val headerItems = lazyState.layoutInfo.totalItemsCount - state.shown.size - 1
        if (reducedMotion) {
            lazyState.scrollToItem(index + headerItems)
        } else {
            lazyState.animateScrollToItem(index + headerItems)
        }
        viewModel.consumeJustAdded()
    }

    state.adding?.let { draft ->
        EntrySheet(
            movie = draft.movie,
            tmdbId = draft.tmdbId,
            subtitle = "Entra como #${state.ranking.size + 1}; depois é só arrastar",
            initialDate = null,
            initialComment = "",
            adding = true,
            onSave = { date, comment -> viewModel.confirmAdd(draft, date, comment) },
            onRemove = null,
            onDismiss = viewModel::cancelAdd
        )
    }

    state.editing?.let { entry ->
        EntrySheet(
            movie = entry.movie,
            tmdbId = entry.tmdbId,
            subtitle = "#${state.positions[entry.id]} na lista",
            initialDate = entry.watchedOn,
            initialComment = entry.comment,
            adding = false,
            onSave = { date, comment -> viewModel.save(entry, date, comment) },
            onRemove = { viewModel.remove(entry) },
            onDismiss = viewModel::closeEditor
        )
    }
}

/**
 * Calcula se os botões de topo e fim aparecem: depois de rolar 600dp, e enquanto faltar mais de
 * 600dp para o fim. A distância até o fim é estimada pelo tamanho médio dos itens visíveis.
 */
@Composable
private fun rememberScrollButtons(lazyState: LazyListState) = with(LocalDensity.current) {
    val threshold = SCROLL_BUTTON_THRESHOLD_DP.dp.toPx()
    remember(lazyState, threshold) {
        derivedStateOf {
            val info = lazyState.layoutInfo
            val visible = info.visibleItemsInfo
            if (visible.isEmpty()) return@derivedStateOf false to false
            val average = visible.sumOf { it.size }.toFloat() / visible.size
            val scrolled = lazyState.firstVisibleItemIndex * average + lazyState.firstVisibleItemScrollOffset
            val last = visible.last()
            val hidden = (info.totalItemsCount - 1 - last.index) * average
            val fromEnd = hidden + (last.offset + last.size - info.viewportEndOffset).coerceAtLeast(0)
            (scrolled > threshold) to (fromEnd > threshold)
        }
    }
}

@Composable
private fun AccountMenu(onSignOut: () -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        IconButton(onClick = {
            open = true
        }) { Icon(Icons.Filled.MoreVert, contentDescription = "Mais opções", tint = LombadaColors.Paper2) }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }, containerColor = LombadaColors.ShelfHigh) {
            DropdownMenuItem(text = { Text("Sair da conta") }, onClick = {
                open = false
                onSignOut()
            })
        }
    }
}

@Composable
private fun Loading() {
    Box(
        Modifier
            .fillMaxWidth()
            .padding(48.dp),
        contentAlignment = Alignment.Center
    ) { CircularProgressIndicator(color = LombadaColors.Sticker) }
}

@Composable
private fun EmptyShelf() {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 28.dp, vertical = 36.dp)
    ) {
        Text("A prateleira está vazia", style = MaterialTheme.typography.titleLarge, textAlign = TextAlign.Center)
        Text(
            "Busque um filme acima para registrar o primeiro.",
            style = MaterialTheme.typography.bodyLarge.copy(fontSize = 15.sp),
            color = LombadaColors.Paper2,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp)
        )
    }
}
