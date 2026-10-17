package io.github.guilhermetelles.lombada.ui.detail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.backend.BackendErrorCode
import io.github.guilhermetelles.lombada.data.backend.BackendException
import io.github.guilhermetelles.lombada.data.model.Movie
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
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
 */
data class MovieDetailUiState(val movie: Movie? = null, val refresh: RefreshStatus = RefreshStatus.Refreshing)

/**
 * Detalhe do filme: mostra na hora o que está no cache do Firestore e chama
 * `GET /api/movies/{tmdbId}` em toda abertura. Quando o backend atualiza o documento, a tela troca
 * sozinha pelo listener.
 *
 * @param container Dependências do app.
 * @param tmdbId Filme.
 */
class MovieDetailViewModel(private val container: AppContainer, private val tmdbId: Int) : ViewModel() {
    private val refresh = MutableStateFlow(RefreshStatus.Refreshing)

    /** Estado da tela. */
    val state: StateFlow<MovieDetailUiState> =
        combine(
            container.movies.observe(tmdbId).onStart {
                emit(null)
            },
            refresh
        ) { movie, status -> MovieDetailUiState(movie, status) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), MovieDetailUiState())

    init {
        retry()
    }

    /** Pede ao backend de novo. */
    fun retry() {
        refresh.value = RefreshStatus.Refreshing
        viewModelScope.launch {
            refresh.value =
                try {
                    container.backend.refreshMovie(tmdbId)
                    RefreshStatus.Done
                } catch (error: BackendException) {
                    if (error.code == BackendErrorCode.NETWORK) RefreshStatus.Offline else RefreshStatus.Failed
                }
        }
    }
}
