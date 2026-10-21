package io.github.guilhermetelles.lombada.ui.detail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.backend.BackendErrorCode
import io.github.guilhermetelles.lombada.data.backend.BackendException
import io.github.guilhermetelles.lombada.data.model.Compat
import io.github.guilhermetelles.lombada.data.model.Movie
import io.github.guilhermetelles.lombada.data.model.RecsDoc
import io.github.guilhermetelles.lombada.domain.FilmInfo
import io.github.guilhermetelles.lombada.domain.Formatting
import io.github.guilhermetelles.lombada.domain.MovieTitles
import io.github.guilhermetelles.lombada.ui.SCREEN_SHARING
import kotlin.math.roundToInt
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** Andamento da atualização do filme pelo backend. */
enum class RefreshStatus {
    /** Pedindo ao backend. */
    Refreshing,

    /** O backend respondeu; o Firestore já tem os dados em dia. */
    Done,

    /** Sem rede. */
    Offline,

    /** O backend ou uma fonte falhou. */
    Failed
}

/**
 * Estado do detalhe.
 *
 * @property movie Filme do Firestore (cache primeiro), ou null enquanto não chega.
 * @property refresh Andamento da atualização.
 * @property compat Compatibilidade com a lista, quando o backend calculou.
 * @property queued Se o filme está na fila "Quero ver".
 * @property queueBusy Se o pedido de pôr ou tirar da fila está em andamento.
 * @property similarInfo O que se sabe dos filmes parecidos de fora da lista, por id.
 */
data class MovieDetailUiState(
    val movie: Movie? = null,
    val refresh: RefreshStatus = RefreshStatus.Refreshing,
    val compat: Compat? = null,
    val queued: Boolean = false,
    val queueBusy: Boolean = false,
    val similarInfo: Map<Int, FilmInfo> = emptyMap()
)

/**
 * Página única de filme, da lista ou de fora: mostra na hora o que está no cache do Firestore e
 * chama `GET /api/movies/{tmdbId}?listId=` em toda abertura (que também traz a compatibilidade).
 * Quando o backend atualiza o documento, a tela troca sozinha pelo listener.
 *
 * @param container Dependências do app.
 * @param tmdbId Filme.
 * @param listId Lista ativa.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class MovieDetailViewModel(private val container: AppContainer, private val tmdbId: Int, private val listId: String) :
    ViewModel() {
    private val refresh = MutableStateFlow(RefreshStatus.Refreshing)
    private val compat = MutableStateFlow<Compat?>(null)

    // Fila vista na tela durante o pedido, antes do Firestore confirmar.
    private val queueOverride = MutableStateFlow<Boolean?>(null)
    private val queueBusy = MutableStateFlow(false)

    private val movie: Flow<Movie?> = container.movies.observe(tmdbId).onStart { emit(null) }

    private val inQueue: Flow<Boolean> =
        container.queue
            .observe(listId)
            .map { items -> items.any { it.tmdbId == tmdbId } }
            .catch { emit(false) }
            // O Firestore confirmou o pedido: a partir daí vale a fila de verdade.
            .onEach { queued -> if (queueOverride.value == queued) queueOverride.value = null }
            .onStart { emit(false) }

    private val recs: Flow<RecsDoc?> = container.recs.observe(listId).onStart { emit(null) }.catch { emit(null) }

    // Títulos e capas dos parecidos: `movies/` quando o filme já está no banco, senão as sugestões.
    private val similarInfo: Flow<Map<Int, FilmInfo>> =
        movie
            .map { it?.recs.orEmpty() }
            .distinctUntilChanged()
            .flatMapLatest { ids ->
                combine(
                    container.movies.observeMany(ids).onStart {
                        emit(emptyMap())
                    }.catch { emit(emptyMap()) },
                    recs,
                    container.titleLanguage.language
                ) {
                        movies,
                        doc,
                        language
                    ->
                    val suggested =
                        doc
                            ?.let { it.items + it.trending }
                            .orEmpty()
                            .filter { it.tmdbId in ids }
                            .associate {
                                it.tmdbId to
                                    FilmInfo(it.tmdbId, MovieTitles.of(it, language), it.year, it.posterPath, it.score)
                            }
                    val stored =
                        movies.mapValues { (id, film) ->
                            FilmInfo(
                                id,
                                MovieTitles.of(film, language),
                                film.year,
                                film.posterPath,
                                suggested[id]?.score
                            )
                        }
                    suggested + stored
                }
            }

    /** Estado da tela. */
    val state: StateFlow<MovieDetailUiState> =
        combine(
            combine(movie, refresh, compat, ::Triple),
            combine(inQueue, queueOverride, queueBusy, ::Triple),
            similarInfo.onStart { emit(emptyMap()) }
        ) { (film, status, fit), (queued, override, busy), similar ->
            MovieDetailUiState(film, status, fit, override ?: queued, busy, similar)
        }.stateIn(viewModelScope, SCREEN_SHARING, MovieDetailUiState())

    init {
        retry()
    }

    /** Pede ao backend de novo. */
    fun retry() {
        refresh.value = RefreshStatus.Refreshing
        viewModelScope.launch {
            refresh.value =
                try {
                    val response = container.backend.refreshMovie(tmdbId, listId)
                    compat.value = response.compat?.let { Compat(it.score.roundToInt().coerceIn(0, 100), it.reason) }
                    RefreshStatus.Done
                } catch (error: BackendException) {
                    if (error.code == BackendErrorCode.NETWORK) RefreshStatus.Offline else RefreshStatus.Failed
                }
        }
    }

    /**
     * Põe o filme na fila "Quero ver" ou tira dela, pelo backend.
     *
     * @param title Título, para o aviso.
     */
    fun toggleQueue(title: String) {
        if (queueBusy.value) return
        val adding = !state.value.queued
        val name = Formatting.shortTitle(title)
        queueBusy.value = true
        queueOverride.value = adding
        viewModelScope.launch {
            try {
                if (adding) {
                    container.backend.addToQueue(
                        listId,
                        tmdbId
                    )
                } else {
                    container.backend.removeFromQueue(listId, tmdbId)
                }
                container.snackbar.showSnackbar(if (adding) "$name entrou em Quero ver" else "$name saiu da fila")
            } catch (error: BackendException) {
                queueOverride.value = null
                container.snackbar.showSnackbar(
                    if (error.code == BackendErrorCode.NETWORK) {
                        "Sem internet para mudar a fila."
                    } else {
                        "Não deu para mudar a fila. Tente de novo."
                    }
                )
            } finally {
                queueBusy.value = false
            }
        }
    }
}
