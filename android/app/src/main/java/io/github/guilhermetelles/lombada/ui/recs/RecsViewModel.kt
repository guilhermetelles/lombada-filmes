package io.github.guilhermetelles.lombada.ui.recs

import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarResult
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.backend.BackendErrorCode
import io.github.guilhermetelles.lombada.data.backend.BackendException
import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.RecItem
import io.github.guilhermetelles.lombada.data.model.RecsDoc
import io.github.guilhermetelles.lombada.domain.Formatting
import io.github.guilhermetelles.lombada.domain.RecKindFilter
import io.github.guilhermetelles.lombada.domain.RecOrigin
import io.github.guilhermetelles.lombada.domain.RecsLines
import io.github.guilhermetelles.lombada.domain.TasteProfile
import io.github.guilhermetelles.lombada.domain.TasteProfiles
import java.time.Instant
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Uma sugestão pronta para a tela.
 *
 * @property item Sugestão de `recs/current`.
 * @property label Selo do tipo ("Saga", "Em alta"), ou null.
 * @property generated Se o motivo foi escrito pelo Gemini.
 * @property origins Filmes da lista que justificam ("por causa de").
 * @property inQueue Se já está na fila.
 * @property busy Se o "Quero ver" está em andamento.
 */
data class RecRow(
    val item: RecItem,
    val label: String?,
    val generated: Boolean,
    val origins: List<RecOrigin>,
    val inQueue: Boolean,
    val busy: Boolean
)

/**
 * Estado da aba Sugestões.
 *
 * @property loading Se a lista ou o documento das sugestões ainda não chegaram.
 * @property films Filmes na lista.
 * @property hasRecs Se a rotina já calculou as sugestões desta lista.
 * @property computedAt Quando calculou.
 * @property profile Perfil de gosto.
 * @property filters Filtros por tipo que têm sugestão.
 * @property filter Filtro escolhido.
 * @property items Sugestões visíveis no filtro escolhido.
 * @property unfiltered Quantas sugestões há sem o filtro por tipo.
 * @property trending "Em alta para vocês", já sem as escondidas.
 * @property queueCount Filmes na fila que ainda não estão na lista.
 */
data class RecsUiState(
    val loading: Boolean = true,
    val films: Int = 0,
    val hasRecs: Boolean = false,
    val computedAt: Instant? = null,
    val profile: TasteProfile = TasteProfile(0, emptyList(), emptyList(), emptyList(), null),
    val filters: List<RecKindFilter> = listOf(RecKindFilter.All),
    val filter: RecKindFilter = RecKindFilter.All,
    val items: List<RecRow> = emptyList(),
    val unfiltered: Int = 0,
    val trending: List<RecRow> = emptyList(),
    val queueCount: Int = 0
)

/** Documento das sugestões e se já chegou (null com [loaded] é lista sem cálculo ainda). */
private data class RecsLoad(val doc: RecsDoc?, val loaded: Boolean)

/** O que muda nesta visita: filtro, postos na fila agora e pedidos em andamento. */
private data class LocalState(
    val filter: RecKindFilter = RecKindFilter.All,
    val queuedHere: Set<Int> = emptySet(),
    val busy: Set<Int> = emptySet()
)

/** Lista carregada: ranking e se já chegou do Firestore. */
private data class ListLoad(val ranking: List<Entry>, val loaded: Boolean)

/**
 * Aba Sugestões: lê `recs/current`, a fila e `dismissed`, calcula o perfil de gosto a partir das
 * entradas e de `movies/`, e trata "Quero ver" (pela rota da fila) e "Não quero" (grava
 * `dismissed/{tmdbId}`, com "Desfazer" que apaga o documento).
 *
 * @param container Dependências do app.
 * @param listId Lista ativa.
 * @param uid Pessoa logada.
 * @param ranking Entradas na ordem do ranking, e se a lista já carregou.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class RecsViewModel(
    private val container: AppContainer,
    private val listId: String,
    private val uid: String,
    ranking: Flow<Pair<List<Entry>, Boolean>>
) : ViewModel() {
    private val local = MutableStateFlow(LocalState())

    private val list: Flow<ListLoad> =
        ranking.map { (entries, loaded) -> ListLoad(entries, loaded) }.distinctUntilChanged()

    private val profile: Flow<TasteProfile> =
        list
            .map { it.ranking }
            .distinctUntilChanged()
            .flatMapLatest { entries ->
                container.movies
                    .observeMany(entries.map { it.tmdbId })
                    .onStart { emit(emptyMap()) }
                    .catch { emit(emptyMap()) }
                    .map { movies -> TasteProfiles.of(entries, movies) }
            }

    private val recs: Flow<RecsLoad> =
        container.recs
            .observe(listId)
            .map { RecsLoad(it, loaded = true) }
            .onStart { emit(RecsLoad(null, loaded = false)) }
            .catch { emit(RecsLoad(null, loaded = true)) }

    private val queue: Flow<Set<Int>> =
        container.queue
            .observe(listId)
            .map { items -> items.map { it.tmdbId }.toSet() }
            .onStart { emit(emptySet()) }
            .catch { emit(emptySet()) }

    private val dismissed: Flow<Set<Int>> =
        container.dismissed.observe(listId).onStart { emit(emptySet()) }.catch { emit(emptySet()) }

    /** Estado da tela. */
    val state: StateFlow<RecsUiState> =
        combine(
            combine(list, profile, recs) { list, profile, recs -> Triple(list, profile, recs) },
            queue,
            dismissed,
            local
        ) { (list, profile, recs), queue, dismissed, local ->
            build(list, profile, recs, queue, dismissed, local)
        }.distinctUntilChanged()
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), RecsUiState())

    private fun build(
        list: ListLoad,
        profile: TasteProfile,
        recs: RecsLoad,
        queue: Set<Int>,
        dismissed: Set<Int>,
        local: LocalState
    ): RecsUiState {
        val inList = list.ranking.map { it.tmdbId }.toSet()
        val doc = recs.doc
        fun rows(items: List<RecItem>) = items.map { item ->
            RecRow(
                item = item,
                label = RecsLines.kindLabel(item),
                generated = RecsLines.isGenerated(item.reason),
                origins = RecsLines.origins(item.reasonFrom, list.ranking),
                inQueue = item.tmdbId in queue || item.tmdbId in local.queuedHere,
                busy = item.tmdbId in local.busy
            )
        }
        val all = RecsLines.visible(doc?.items.orEmpty(), inList, dismissed, queue, local.queuedHere)
        val filters = RecsLines.filtersFor(all)
        // O filtro escolhido pode ter ficado sem nenhuma sugestão (todas recusadas): volta para "Tudo".
        val filter = local.filter.takeIf { it in filters } ?: RecKindFilter.All
        val shown = if (filter == RecKindFilter.All) all else all.filter { it.kind == filter.kind }
        return RecsUiState(
            loading = !list.loaded || !recs.loaded,
            films = list.ranking.size,
            hasRecs = doc != null,
            computedAt = doc?.computedAt,
            profile = profile,
            filters = filters,
            filter = filter,
            items = rows(shown),
            unfiltered = all.size,
            trending = rows(RecsLines.visible(doc?.trending.orEmpty(), inList, dismissed, queue, local.queuedHere)),
            queueCount = (queue - inList).size
        )
    }

    /**
     * Escolhe o filtro por tipo.
     *
     * @param filter Filtro.
     */
    fun setFilter(filter: RecKindFilter) {
        local.update { it.copy(filter = filter) }
    }

    /**
     * "Quero ver": põe o filme na fila pela rota do backend. A sugestão continua na tela, com
     * "Na fila", até a pessoa sair da aba.
     *
     * @param item Sugestão.
     */
    fun want(item: RecItem) {
        val tmdbId = item.tmdbId
        val current = local.value
        if (tmdbId in current.busy || tmdbId in current.queuedHere) return
        // Marca antes do pedido: a fila do Firestore pode chegar antes da resposta e esconder a sugestão.
        local.update { it.copy(queuedHere = it.queuedHere + tmdbId, busy = it.busy + tmdbId) }
        val title = Formatting.shortTitle(item.title)
        viewModelScope.launch {
            try {
                container.backend.addToQueue(listId, tmdbId)
                local.update { it.copy(busy = it.busy - tmdbId) }
                container.snackbar.showSnackbar("$title entrou em Quero ver")
            } catch (error: BackendException) {
                local.update { it.copy(queuedHere = it.queuedHere - tmdbId, busy = it.busy - tmdbId) }
                container.snackbar.showSnackbar(
                    if (error.code == BackendErrorCode.NETWORK) {
                        "Sem internet: $title não entrou na fila."
                    } else {
                        "Não deu para pôr $title na fila."
                    }
                )
            }
        }
    }

    /**
     * "Não quero": grava `dismissed/{tmdbId}`, que tira o filme das sugestões nos dois celulares e
     * da próxima rotina. "Desfazer" apaga o documento.
     *
     * @param item Sugestão.
     */
    fun dismiss(item: RecItem) {
        val tmdbId = item.tmdbId
        container.dismissed.dismiss(listId, tmdbId, uid)
        val title = Formatting.shortTitle(item.title)
        // No escopo do app: o "Desfazer" vale mesmo se a pessoa sair da aba.
        container.appScope.launch {
            val result =
                container.snackbar.showSnackbar(
                    "$title não vai mais aparecer nas sugestões",
                    actionLabel = "Desfazer",
                    duration = SnackbarDuration.Long
                )
            if (result == SnackbarResult.ActionPerformed) container.dismissed.undo(listId, tmdbId)
        }
    }
}
