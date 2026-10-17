package io.github.guilhermetelles.lombada.ui.list

import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarResult
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.domain.EntryOrder
import io.github.guilhermetelles.lombada.domain.Formatting
import java.time.LocalDate
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Como a lista está ordenada na tela. */
enum class SortMode {
    /** Ranking, com arrastar ligado. */
    Ranking,

    /** "Ordem em que vimos", por data, sem arrastar. */
    WatchedDate
}

/**
 * Estado da lista.
 *
 * @property loading Se as entradas ainda não chegaram.
 * @property ranking Entradas na ordem do ranking; dá a posição de cada uma.
 * @property shown Entradas na ordem em que aparecem (o ranking, a ordem de um arraste ou por data).
 * @property sortMode Ordem escolhida.
 * @property newestFirst Na ordem por data, se as mais recentes vêm primeiro.
 * @property editing Entrada aberta na folha de edição.
 */
data class ListUiState(
    val loading: Boolean = true,
    val ranking: List<Entry> = emptyList(),
    val shown: List<Entry> = emptyList(),
    val sortMode: SortMode = SortMode.Ranking,
    val newestFirst: Boolean = true,
    val editing: Entry? = null
) {
    /** Posição de cada entrada no ranking, a partir de 1. */
    val positions: Map<String, Int> = ranking.withIndex().associate { (index, entry) -> entry.id to index + 1 }
}

/**
 * Lista ativa: ranking em tempo real, arrastar para reordenar, editar e remover com "Desfazer".
 *
 * @param container Dependências do app.
 * @param listId Lista aberta.
 * @param uid Pessoa logada, gravada em `updatedBy`.
 */
class ListViewModel(private val container: AppContainer, private val listId: String, private val uid: String) :
    ViewModel() {
    private val sortMode = MutableStateFlow(SortMode.Ranking)
    private val newestFirst = MutableStateFlow(true)
    private val editing = MutableStateFlow<String?>(null)

    // Ordem durante o arraste; depois de soltar, fica até o Firestore devolver a ordem nova.
    private val dragOrder = MutableStateFlow<List<Entry>?>(null)
    private var waitingForMove = false

    // Removidas que ainda podem voltar pelo "Desfazer"; somem da tela na hora.
    private val pendingRemovals = MutableStateFlow<Set<String>>(emptySet())

    private val loaded = MutableStateFlow(false)

    private val ranking =
        combine(container.entries.observeRanking(listId), pendingRemovals) { entries, removed ->
            entries.filterNot { it.id in removed }
        }.onEach {
            loaded.value = true
            if (waitingForMove) {
                waitingForMove = false
                dragOrder.value = null
            }
        }

    /** Estado da tela. */
    val state: StateFlow<ListUiState> =
        combine(
            combine(ranking, dragOrder, ::Pair),
            sortMode,
            newestFirst,
            editing,
            loaded
        ) { (entries, drag), mode, newest, editingId, loaded ->
            val shown =
                when {
                    mode == SortMode.WatchedDate -> EntryOrder.byWatchedDate(entries, newest)
                    drag != null -> drag
                    else -> entries
                }
            ListUiState(
                loading = !loaded,
                ranking = entries,
                shown = shown,
                sortMode = mode,
                newestFirst = newest,
                editing = entries.firstOrNull { it.id == editingId }
            )
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), ListUiState())

    /**
     * Troca entre ranking e ordem por data.
     *
     * @param mode Ordem escolhida.
     */
    fun setSortMode(mode: SortMode) {
        sortMode.value = mode
    }

    /** Inverte a ordem por data. */
    fun toggleDateDirection() {
        newestFirst.update { !it }
    }

    /**
     * Acompanha o arraste: a entrada vai para o lugar da outra.
     *
     * @param fromId Entrada arrastada.
     * @param toId Entrada cuja posição ela ocupa agora.
     */
    fun onDragMove(fromId: String, toId: String) {
        val current = dragOrder.value ?: state.value.ranking
        val from = current.indexOfFirst { it.id == fromId }
        val to = current.indexOfFirst { it.id == toId }
        if (from < 0 || to < 0 || from == to) return
        dragOrder.value = current.toMutableList().apply { add(to, removeAt(from)) }
    }

    /**
     * Soltou a entrada: grava só a chave nova dela, entre as vizinhas.
     *
     * @param entryId Entrada arrastada.
     */
    fun onDragStopped(entryId: String) {
        val order = dragOrder.value ?: return
        val toIndex = order.indexOfFirst { it.id == entryId }
        val fromIndex = state.value.ranking.indexOfFirst { it.id == entryId }
        if (toIndex < 0 || toIndex == fromIndex) {
            dragOrder.value = null
            return
        }
        val rankKey =
            runCatching { EntryOrder.rankKeyAt(order, toIndex) }.getOrElse {
                dragOrder.value = null
                message("Não deu para mover agora. Tente de novo.")
                return
            }
        waitingForMove = true
        container.entries.move(listId, entryId, rankKey, uid)
        message("${Formatting.shortTitle(order[toIndex].movie.title)} agora é o #${toIndex + 1}")
    }

    /**
     * Move a entrada por um número de posições, sem arrastar (ações do leitor de tela).
     *
     * @param entryId Entrada.
     * @param delta Posições: -1 sobe uma, 1 desce uma.
     */
    fun moveBy(entryId: String, delta: Int) {
        val ranking = state.value.ranking
        val from = ranking.indexOfFirst { it.id == entryId }
        val to = (from + delta).coerceIn(0, ranking.lastIndex)
        if (from < 0 || from == to) return
        dragOrder.value = ranking.toMutableList().apply { add(to, removeAt(from)) }
        onDragStopped(entryId)
    }

    /**
     * Abre a folha de edição.
     *
     * @param entryId Entrada.
     */
    fun openEditor(entryId: String) {
        editing.value = entryId
    }

    /** Fecha a folha de edição. */
    fun closeEditor() {
        editing.value = null
    }

    /**
     * Salva data e comentário.
     *
     * @param entry Entrada editada.
     * @param watchedOn Data, ou null.
     * @param comment Comentário.
     */
    fun save(entry: Entry, watchedOn: LocalDate?, comment: String) {
        editing.value = null
        container.entries.edit(listId, entry.id, watchedOn, comment.trim().take(5_000), uid)
        message("Registro salvo")
    }

    /**
     * Tira a entrada da tela e só apaga no banco quando o "Desfazer" some sem ser tocado.
     *
     * @param entry Entrada a remover.
     */
    fun remove(entry: Entry) {
        editing.value = null
        val position = state.value.positions[entry.id] ?: return
        pendingRemovals.update { it + entry.id }
        val title = Formatting.shortTitle(entry.movie.title)
        // No escopo do app: a remoção acontece mesmo se a pessoa sair da tela.
        container.appScope.launch {
            val result =
                container.snackbar.showSnackbar(
                    "$title saiu da lista",
                    actionLabel = "Desfazer",
                    duration = SnackbarDuration.Short
                )
            if (result == SnackbarResult.ActionPerformed) {
                pendingRemovals.update { it - entry.id }
                container.snackbar.showSnackbar("$title voltou para o #$position")
            } else {
                // O id continua escondido: o Firestore some com a entrada logo em seguida.
                container.entries.remove(listId, entry.id)
            }
        }
    }

    private fun message(text: String) {
        viewModelScope.launch { container.snackbar.showSnackbar(text) }
    }
}
