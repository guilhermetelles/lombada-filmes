package io.github.guilhermetelles.lombada.ui.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.backend.BackendErrorCode
import io.github.guilhermetelles.lombada.data.backend.BackendException
import io.github.guilhermetelles.lombada.data.backend.MovieSearchResult
import io.github.guilhermetelles.lombada.data.backend.PersonSearchResult
import io.github.guilhermetelles.lombada.domain.ListMatch
import io.github.guilhermetelles.lombada.domain.ListSearch
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

/**
 * Resultado de uma rota de busca.
 *
 * @property loading Se a rota ainda não respondeu.
 * @property items Resultados.
 * @property error Mensagem quando a rota falhou.
 */
data class RemoteResults<T>(val loading: Boolean = false, val items: List<T> = emptyList(), val error: String? = null)

/**
 * Os três grupos da busca.
 *
 * @property query Termo digitado.
 * @property inList "Na lista de vocês", na hora.
 * @property people "Pessoas", de `GET /api/search/people`.
 * @property movies "Filmes", de `GET /api/search`.
 */
data class SearchUiState(
    val query: String = "",
    val inList: List<ListMatch> = emptyList(),
    val people: RemoteResults<PersonSearchResult> = RemoteResults(),
    val movies: RemoteResults<MovieSearchResult> = RemoteResults()
) {
    /** Se a busca está ativa (a lista dá lugar aos resultados). */
    val active: Boolean get() = query.isNotBlank()
}

private data class Remote(val people: RemoteResults<PersonSearchResult>, val movies: RemoteResults<MovieSearchResult>)

/**
 * Busca de filmes, atores e diretores: o grupo da lista sai na hora; os outros dois, 300 ms
 * depois da última tecla, a partir de 2 letras, em paralelo.
 *
 * @param container Dependências do app.
 * @param listId Lista aberta.
 */
@OptIn(FlowPreview::class, ExperimentalCoroutinesApi::class)
class SearchViewModel(private val container: AppContainer, listId: String) : ViewModel() {
    private val query = MutableStateFlow("")

    private val ranking = container.entries.observeRanking(listId)

    private val cast =
        ranking
            .map { entries -> entries.map { it.tmdbId }.toSet() }
            .distinctUntilChanged()
            .flatMapLatest { ids -> container.movies.observeMany(ids) }
            .map { movies -> movies.mapValues { it.value.cast } }

    private val remote =
        query
            .map { it.trim() }
            .distinctUntilChanged()
            .debounce(300)
            .flatMapLatest { term ->
                flow {
                    if (term.length < 2) {
                        emit(Remote(RemoteResults(), RemoteResults()))
                        return@flow
                    }
                    emit(Remote(RemoteResults(loading = true), RemoteResults(loading = true)))
                    emit(
                        coroutineScope {
                            val people = async { fetch { container.backend.searchPeople(term) } }
                            val movies = async { fetch { container.backend.searchMovies(term) } }
                            Remote(people.await(), movies.await())
                        }
                    )
                }
            }

    /** Estado da busca. */
    val state: StateFlow<SearchUiState> =
        combine(query, ranking, cast, remote) { text, entries, castByMovie, results ->
            SearchUiState(
                query = text,
                inList = ListSearch.match(text, entries, castByMovie),
                people = if (text.trim().length < 2) RemoteResults() else results.people,
                movies = if (text.trim().length < 2) RemoteResults() else results.movies
            )
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), SearchUiState())

    /**
     * Atualiza o termo.
     *
     * @param text Texto do campo.
     */
    fun onQueryChange(text: String) {
        query.value = text.take(100)
    }

    /** Limpa a busca e volta para a lista. */
    fun clear() {
        query.value = ""
    }

    private suspend fun <T> fetch(block: suspend () -> List<T>): RemoteResults<T> = try {
        RemoteResults(items = block())
    } catch (error: BackendException) {
        RemoteResults(
            error =
                when (error.code) {
                    BackendErrorCode.NETWORK -> "Sem internet para buscar."
                    BackendErrorCode.SOURCE_UNAVAILABLE -> "O TMDb não respondeu. Tente de novo em instantes."
                    else -> "A busca falhou. Tente de novo."
                }
        )
    }
}
