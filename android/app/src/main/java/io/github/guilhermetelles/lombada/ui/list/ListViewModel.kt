package io.github.guilhermetelles.lombada.ui.list

import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarResult
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.backend.BackendErrorCode
import io.github.guilhermetelles.lombada.data.backend.BackendException
import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.MovieSnapshot
import io.github.guilhermetelles.lombada.data.model.PersonRef
import io.github.guilhermetelles.lombada.domain.EntryOrder
import io.github.guilhermetelles.lombada.domain.Formatting
import io.github.guilhermetelles.lombada.domain.MovieTitles
import io.github.guilhermetelles.lombada.events.ListEventType
import io.github.guilhermetelles.lombada.events.ListEvents
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
 * @property adding Filme pronto para registrar, na folha.
 * @property preparingTmdbId Filme cujos dados estão sendo buscados antes de abrir a folha.
 * @property justAddedId Entrada recém-adicionada: a tela rola até ela e cola a etiqueta.
 */
data class ListUiState(
    val loading: Boolean = true,
    val ranking: List<Entry> = emptyList(),
    val shown: List<Entry> = emptyList(),
    val sortMode: SortMode = SortMode.Ranking,
    val newestFirst: Boolean = true,
    val editing: Entry? = null,
    val adding: AddDraft? = null,
    val preparingTmdbId: Int? = null,
    val justAddedId: String? = null
) {
    /** Posição de cada entrada no ranking, a partir de 1. */
    val positions: Map<String, Int> = ranking.withIndex().associate { (index, entry) -> entry.id to index + 1 }

    /** Entrada de cada filme da lista, por tmdbId. */
    val entryByTmdbId: Map<Int, String> = ranking.associate { it.tmdbId to it.id }
}

/**
 * Filme escolhido na busca, com a cópia resumida já montada a partir de `GET /api/movies/{tmdbId}`.
 *
 * @property tmdbId Filme.
 * @property movie Cópia resumida para a entrada.
 */
data class AddDraft(val tmdbId: Int, val movie: MovieSnapshot)

private data class AddState(
    val draft: AddDraft? = null,
    val preparingTmdbId: Int? = null,
    val justAddedId: String? = null,
    val stayOnPage: Boolean = false
)

/**
 * Lista ativa: ranking em tempo real, arrastar para reordenar, editar e remover com "Desfazer".
 * Adicionar, mover e comentar entram na fila de eventos ([ListEvents]) da Atividade.
 *
 * @param container Dependências do app.
 * @param listId Lista aberta.
 * @param uid Pessoa logada, gravada em `updatedBy`.
 * @param events Fila de eventos da lista.
 */
class ListViewModel(
    private val container: AppContainer,
    private val listId: String,
    private val uid: String,
    private val events: ListEvents
) : ViewModel() {
    private val sortMode = MutableStateFlow(SortMode.Ranking)
    private val newestFirst = MutableStateFlow(true)
    private val editing = MutableStateFlow<String?>(null)
    private val add = MutableStateFlow(AddState())

    // Ordem durante o arraste; depois de soltar, fica até o Firestore devolver a ordem nova.
    private val dragOrder = MutableStateFlow<List<Entry>?>(null)
    private var waitingForMove = false

    // Removidas que ainda podem voltar pelo "Desfazer"; somem da tela na hora.
    private val pendingRemovals = MutableStateFlow<Set<String>>(emptySet())

    private val loaded = MutableStateFlow(false)

    private val ranking =
        combine(container.rankings.observe(listId), pendingRemovals) { entries, removed ->
            entries.filterNot { it.id in removed }
        }.onEach {
            loaded.value = true
            if (waitingForMove) {
                waitingForMove = false
                dragOrder.value = null
            }
        }

    /** Mudanças esperando conexão (eventos na fila com o aparelho sem internet). */
    val waitingChanges: StateFlow<Int> =
        events.observeWaiting(listId).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    /** Estado da tela. */
    val state: StateFlow<ListUiState> =
        combine(
            combine(ranking, dragOrder, add, ::Triple),
            sortMode,
            newestFirst,
            editing,
            loaded
        ) { (entries, drag, adding), mode, newest, editingId, isLoaded ->
            val shown =
                when {
                    mode == SortMode.WatchedDate -> EntryOrder.byWatchedDate(entries, newest)
                    drag != null -> drag
                    else -> entries
                }
            ListUiState(
                loading = !isLoaded,
                ranking = entries,
                shown = shown,
                sortMode = mode,
                newestFirst = newest,
                editing = entries.firstOrNull { it.id == editingId },
                adding = adding.draft,
                preparingTmdbId = adding.preparingTmdbId,
                justAddedId = adding.justAddedId
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
        events.record(listId, ListEventType.Moved, entryId)
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
        val text = comment.trim().take(5_000)
        container.entries.edit(listId, entry.id, watchedOn, text, uid)
        if (text.isNotEmpty() && text != entry.comment.trim()) events.record(listId, ListEventType.Commented, entry.id)
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
                    duration = SnackbarDuration.Long
                )
            if (result == SnackbarResult.ActionPerformed) {
                pendingRemovals.update { it - entry.id }
                container.snackbar.showSnackbar("$title voltou para o #$position")
            } else {
                // O id continua escondido: o Firestore some com a entrada logo em seguida.
                container.entries.remove(listId, entry.id)
                events.recordRemoval(listId, entry.id, entry.tmdbId)
            }
        }
    }

    /**
     * Prepara o registro de um filme da busca: garante o filme no banco com os dados em dia e
     * abre a folha. Se o filme já está na lista, só avisa.
     *
     * @param tmdbId Filme escolhido.
     * @param stayOnPage Se quem adiciona fica na página do filme (que vira a de um filme da lista)
     *   em vez de voltar para a lista.
     */
    fun startAdd(tmdbId: Int, stayOnPage: Boolean = false) {
        val current = state.value
        current.ranking.firstOrNull { it.tmdbId == tmdbId }?.let { entry ->
            message(
                "${Formatting.shortTitle(
                    entry.movie.title
                )} já está na prateleira, como #${current.positions[entry.id]}"
            )
            return
        }
        if (add.value.preparingTmdbId != null) return
        add.update { it.copy(preparingTmdbId = tmdbId, stayOnPage = stayOnPage) }
        viewModelScope.launch {
            try {
                val movie = container.backend.refreshMovie(tmdbId)
                // Na tela, o título no idioma escolhido; o inglês fica em titleAlt e é o que vai gravado.
                val shown = MovieTitles.pick(movie.title, movie.titlePt, container.titleLanguage.language.value)
                val snapshot =
                    MovieSnapshot(
                        title = shown,
                        titleAlt = movie.title.takeIf { it != shown },
                        year = movie.year,
                        posterPath = movie.posterPath,
                        imdb = movie.ratings.imdb?.value,
                        letterboxd = movie.ratings.letterboxd?.value,
                        directors = movie.directors.take(8).map { PersonRef(it.id, it.name) }
                    )
                add.update { it.copy(draft = AddDraft(tmdbId, snapshot), preparingTmdbId = null) }
            } catch (error: BackendException) {
                add.update { it.copy(preparingTmdbId = null) }
                message(
                    when (error.code) {
                        BackendErrorCode.NETWORK -> "Sem internet para buscar os dados do filme."
                        BackendErrorCode.NOT_FOUND -> "O TMDb não tem esse filme."
                        else -> "Não deu para buscar os dados do filme. Tente de novo."
                    }
                )
            }
        }
    }

    /** Fecha a folha de registro sem adicionar. */
    fun cancelAdd() {
        add.update { it.copy(draft = null) }
    }

    /**
     * Registra o filme no fim da lista, com "Desfazer". Pela página do filme, a pessoa fica nela;
     * de outro lugar, a lista rola até a entrada nova.
     *
     * @param draft Filme escolhido.
     * @param watchedOn Data em que viram.
     * @param comment Comentário.
     */
    fun confirmAdd(draft: AddDraft, watchedOn: LocalDate?, comment: String) {
        val ranking = state.value.ranking
        val rankKey = EntryOrder.endKey(ranking.lastOrNull()?.rankKey)
        val entryId = container.entries.create(
            listId,
            draft.tmdbId,
            rankKey,
            watchedOn,
            comment.trim().take(5_000),
            draft.movie,
            uid
        )
        events.record(listId, ListEventType.Added, entryId)
        val stay = add.value.stayOnPage
        add.value = AddState(justAddedId = entryId.takeUnless { stay })
        val title = Formatting.shortTitle(draft.movie.title)
        val position = ranking.size + 1
        val added = "$title entrou como #$position"
        val text = if (stay) "$added; arraste na lista para posicionar" else added
        // No escopo do app: o "Desfazer" vale mesmo se a pessoa sair da tela.
        container.appScope.launch {
            val result = container.snackbar.showSnackbar(
                text,
                actionLabel = "Desfazer",
                duration = SnackbarDuration.Long
            )
            if (result == SnackbarResult.ActionPerformed) {
                // Se o "added" já foi enviado, a outra pessoa precisa saber que o filme saiu.
                events.recordRemoval(listId, entryId, draft.tmdbId)
                container.entries.remove(listId, entryId)
                container.snackbar.showSnackbar("$title saiu da lista")
            }
        }
    }

    /**
     * Registra um evento feito por outra tela, como a troca do duelo pela `EntryRepository.move`.
     *
     * @param type Tipo.
     * @param entryId Entrada.
     */
    fun recordEvent(type: ListEventType, entryId: String) {
        events.record(listId, type, entryId)
    }

    /** A tela já rolou até a entrada nova. */
    fun consumeJustAdded() {
        add.update { it.copy(justAddedId = null) }
    }

    private fun message(text: String) {
        viewModelScope.launch { container.snackbar.showSnackbar(text) }
    }
}
