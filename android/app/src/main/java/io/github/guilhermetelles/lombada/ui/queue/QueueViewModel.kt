package io.github.guilhermetelles.lombada.ui.queue

import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarResult
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.backend.BackendErrorCode
import io.github.guilhermetelles.lombada.data.backend.BackendException
import io.github.guilhermetelles.lombada.data.model.Movie
import io.github.guilhermetelles.lombada.data.model.QueueItem
import io.github.guilhermetelles.lombada.domain.Formatting
import io.github.guilhermetelles.lombada.domain.QueueLines
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Um filme da fila, com o documento de `movies/` quando já está no banco.
 *
 * @property item Item da fila.
 * @property movie Filme, ou null enquanto não chega.
 */
data class QueueRow(val item: QueueItem, val movie: Movie?)

/**
 * Estado da aba "Quero ver".
 *
 * @property loading Se a fila ainda não chegou.
 * @property rows Fila visível, do mais recente para o mais antigo, sem os filmes que já estão na lista.
 */
data class QueueUiState(val loading: Boolean = true, val rows: List<QueueRow> = emptyList())

/**
 * Aba "Quero ver": a fila de `lists/{listId}/queue`, com título, capa e onde assistir lidos de
 * `movies/`. Tirar da fila esconde na hora e só chama `DELETE` quando o "Desfazer" some sem toque.
 *
 * @param container Dependências do app.
 * @param listId Lista ativa.
 * @param inList Filmes que já são entradas da lista.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class QueueViewModel(private val container: AppContainer, private val listId: String, inList: Flow<Set<Int>>) :
    ViewModel() {
    // Tirados da fila que ainda podem voltar pelo "Desfazer".
    private val pendingRemovals = MutableStateFlow<Set<Int>>(emptySet())

    private val visible: Flow<List<QueueItem>?> =
        combine(
            // Saiu da fila de verdade: não precisa mais esconder.
            container.queue.observe(listId).onEach { queue ->
                val ids = queue.map { it.tmdbId }.toSet()
                pendingRemovals.update { it intersect ids }
            },
            inList,
            pendingRemovals
        ) { queue, entries, removed ->
            QueueLines.visible(queue, entries).filterNot { it.tmdbId in removed }
        }.onStart<List<QueueItem>?> { emit(null) }.catch { emit(emptyList()) }

    /** Estado da tela. */
    val state: StateFlow<QueueUiState> =
        visible
            .flatMapLatest { items ->
                if (items == null) return@flatMapLatest flowOf(QueueUiState())
                val ids = items.map { it.tmdbId }.toSet()
                container.movies
                    .observeMany(ids)
                    .onStart { emit(emptyMap()) }
                    .catch { emit(emptyMap()) }
                    .map { movies -> QueueUiState(false, items.map { QueueRow(it, movies[it.tmdbId]) }) }
            }.distinctUntilChanged()
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), QueueUiState())

    /**
     * Tira o filme da fila, com "Desfazer".
     *
     * @param row Filme.
     */
    fun remove(row: QueueRow) {
        val tmdbId = row.item.tmdbId
        val title = Formatting.shortTitle(row.movie?.title ?: "O filme")
        pendingRemovals.update { it + tmdbId }
        // No escopo do app: tira da fila mesmo se a pessoa sair da aba.
        container.appScope.launch {
            val result =
                container.snackbar.showSnackbar(
                    "$title saiu de Quero ver",
                    actionLabel = "Desfazer",
                    duration = SnackbarDuration.Long
                )
            if (result == SnackbarResult.ActionPerformed) {
                pendingRemovals.update { it - tmdbId }
                return@launch
            }
            try {
                container.backend.removeFromQueue(listId, tmdbId)
            } catch (error: BackendException) {
                pendingRemovals.update { it - tmdbId }
                container.snackbar.showSnackbar(
                    if (error.code == BackendErrorCode.NETWORK) {
                        "Sem internet: $title continua na fila."
                    } else {
                        "Não deu para tirar $title da fila."
                    }
                )
            }
        }
    }
}
