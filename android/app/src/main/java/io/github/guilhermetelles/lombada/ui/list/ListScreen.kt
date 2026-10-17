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
import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.MovieList
import io.github.guilhermetelles.lombada.ui.main.MovieRoute
import io.github.guilhermetelles.lombada.ui.main.PersonRoute
import io.github.guilhermetelles.lombada.ui.search.SearchBar
import io.github.guilhermetelles.lombada.ui.search.SearchViewModel
import io.github.guilhermetelles.lombada.ui.search.searchResults
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import io.github.guilhermetelles.lombada.ui.theme.rememberReducedMotion
import kotlinx.coroutines.launch
import sh.calvin.reorderable.ReorderableItem
import sh.calvin.reorderable.rememberReorderableLazyListState

private const val SCROLL_BUTTON_THRESHOLD_DP = 600

// Itens antes das fitas: barra do app, nome da lista, busca, ordem e contagem.
private const val LIST_HEADER_ITEMS = 5

/**
 * Tela da lista: cabeçalho, ordem, as fitas e os botões de topo e fim.
 *
 * @param list Lista ativa.
 * @param viewModel Estado da lista, compartilhado com o detalhe e as folhas.
 * @param searchViewModel Estado da busca, que continua ao voltar do detalhe.
 * @param onSwitchList Abre "Suas listas".
 * @param onOpenMovie Abre o detalhe de um filme.
 * @param onOpenPerson Abre a tela de uma pessoa achada na busca.
 * @param onAbout Abre "Sobre".
 * @param onSignOut Sair da conta.
 */
@Composable
fun ListScreen(
    list: MovieList,
    viewModel: ListViewModel,
    searchViewModel: SearchViewModel,
    onSwitchList: () -> Unit,
    onOpenMovie: (MovieRoute) -> Unit,
    onOpenPerson: (PersonRoute) -> Unit,
    onAbout: () -> Unit,
    onSignOut: () -> Unit
) {
    val onOpenEntry: (Entry) -> Unit = { entry ->
        onOpenMovie(MovieRoute(entry.tmdbId, entry.movie.title, entry.movie.year, entry.movie.posterPath))
    }
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
            item(key = "topbar") { LombadaTopBar { AccountMenu(onAbout, onSignOut) } }
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
                    onOpenPerson = { person ->
                        onOpenPerson(PersonRoute(person.personId, person.name, person.profilePath, person.department))
                    },
                    onPickMovie = { movie ->
                        onOpenMovie(MovieRoute(movie.tmdbId, movie.title, movie.year, movie.posterPath))
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
    LaunchedEffect(state.justAddedId, search.active, state.shown.size) {
        val newId = state.justAddedId ?: return@LaunchedEffect
        if (search.active) {
            // Volta aqui quando a busca fechar e as fitas estiverem na lista.
            searchViewModel.clear()
            focusManager.clearFocus()
            return@LaunchedEffect
        }
        val index = state.shown.indexOfFirst { it.id == newId }
        if (index < 0) return@LaunchedEffect
        if (reducedMotion) {
            lazyState.scrollToItem(index + LIST_HEADER_ITEMS)
        } else {
            lazyState.animateScrollToItem(index + LIST_HEADER_ITEMS)
        }
        viewModel.consumeJustAdded()
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
private fun AccountMenu(onAbout: () -> Unit, onSignOut: () -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        IconButton(onClick = { open = true }) {
            Icon(Icons.Filled.MoreVert, contentDescription = "Mais opções", tint = LombadaColors.Paper2)
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }, containerColor = LombadaColors.ShelfHigh) {
            DropdownMenuItem(text = { Text("Sobre") }, onClick = {
                open = false
                onAbout()
            })
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
