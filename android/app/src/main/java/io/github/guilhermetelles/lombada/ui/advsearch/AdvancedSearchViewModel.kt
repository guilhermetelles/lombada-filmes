package io.github.guilhermetelles.lombada.ui.advsearch

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.backend.BackendErrorCode
import io.github.guilhermetelles.lombada.data.backend.BackendException
import io.github.guilhermetelles.lombada.data.model.DiscoverItem
import io.github.guilhermetelles.lombada.data.model.Filters
import io.github.guilhermetelles.lombada.domain.DiscoverFilters
import io.github.guilhermetelles.lombada.domain.DiscoverResults
import io.github.guilhermetelles.lombada.domain.FilterOption
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

// Espera depois de tocar num filtro, para juntar vários toques num pedido só.
private const val FILTER_DEBOUNCE_MS = 400L

/** Tamanho máximo do texto livre aceito pelo `interpret`. */
const val INTERPRET_MAX_LENGTH = 200

/**
 * Estado da busca avançada.
 *
 * @property text Texto livre digitado.
 * @property filters Filtros ligados.
 * @property interpreting Se o `interpret` está respondendo.
 * @property interpretedText Frase que o Gemini interpretou por último; null antes de interpretar.
 * @property explanation O que o Gemini disse que entendeu.
 * @property notice Aviso sobre o texto livre (limite do dia, Gemini fora); os filtros continuam.
 * @property results Resultados carregados, página a página.
 * @property loading Se a primeira página está carregando.
 * @property loadingMore Se a próxima página está carregando.
 * @property page Última página carregada (0 antes da primeira).
 * @property totalPages Páginas que o TMDb tem para esses filtros.
 * @property error Falha da busca, ou null.
 */
data class AdvancedSearchUiState(
    val text: String = "",
    val filters: Filters = Filters(),
    val interpreting: Boolean = false,
    val interpretedText: String? = null,
    val explanation: String? = null,
    val notice: String? = null,
    val results: List<DiscoverItem> = emptyList(),
    val loading: Boolean = true,
    val loadingMore: Boolean = false,
    val page: Int = 0,
    val totalPages: Int = 0,
    val error: String? = null
) {
    /** Se há mais páginas para carregar. */
    val canLoadMore: Boolean get() = !loading && page in 1 until totalPages
}

/**
 * Busca avançada: texto livre interpretado pelo `POST /api/search/interpret` em filtros e os
 * resultados de `GET /api/discover`, ordenados pela compatibilidade. Sem Gemini (limite do dia,
 * chave ausente, sem rede), os filtros manuais continuam valendo.
 *
 * @param container Dependências do app.
 * @param listId Lista ativa, para a compatibilidade e a marca dos filmes que já estão nela.
 */
class AdvancedSearchViewModel(private val container: AppContainer, private val listId: String) : ViewModel() {
    private val mutableState = MutableStateFlow(AdvancedSearchUiState())

    /** Estado da tela. */
    val state: StateFlow<AdvancedSearchUiState> = mutableState.asStateFlow()

    private var searchJob: Job? = null

    init {
        search(debounceMs = 0)
    }

    /**
     * Texto livre novo.
     *
     * @param text Texto digitado.
     */
    fun onTextChange(text: String) {
        mutableState.update { it.copy(text = text.take(INTERPRET_MAX_LENGTH)) }
    }

    /** Interpreta o texto livre e troca os filtros pelos que o Gemini entendeu. */
    fun interpret() {
        val current = mutableState.value
        val text = current.text.trim()
        if (current.interpreting) return
        if (text.length < 2) {
            mutableState.update { it.copy(notice = "Escreva pelo menos duas letras para interpretar.") }
            return
        }
        mutableState.update { it.copy(interpreting = true, notice = null) }
        viewModelScope.launch {
            try {
                val result = container.backend.interpret(text)
                val filters = DiscoverFilters.clean(result.filters)
                val nothing = DiscoverFilters.active(filters).isEmpty()
                mutableState.update {
                    it.copy(
                        interpreting = false,
                        interpretedText = text,
                        explanation = result.explanation.trim().ifEmpty { null },
                        filters = filters,
                        notice =
                            if (nothing) {
                                "Não achei filtros nessa frase. Tente falar de duração, gênero, década, humor ou tema."
                            } else {
                                null
                            }
                    )
                }
                search(debounceMs = 0)
            } catch (error: BackendException) {
                mutableState.update { it.copy(interpreting = false, notice = interpretFailure(error)) }
            }
        }
    }

    /**
     * Liga ou desliga um filtro, inclusive os chips do que o Gemini entendeu.
     *
     * @param option Valor tocado.
     */
    fun toggle(option: FilterOption) {
        mutableState.update { it.copy(filters = DiscoverFilters.toggle(it.filters, option)) }
        search(FILTER_DEBOUNCE_MS)
    }

    /** Tira todos os filtros, o texto e o que foi interpretado. */
    fun clear() {
        mutableState.update {
            it.copy(text = "", filters = Filters(), interpretedText = null, explanation = null, notice = null)
        }
        search(debounceMs = 0)
    }

    /** Busca de novo a primeira página, depois de uma falha. */
    fun retry() {
        search(debounceMs = 0)
    }

    /** Carrega a próxima página. */
    fun loadMore() {
        val current = mutableState.value
        if (!current.canLoadMore || current.loadingMore) return
        val filters = current.filters
        val next = current.page + 1
        mutableState.update { it.copy(loadingMore = true, error = null) }
        searchJob =
            viewModelScope.launch {
                try {
                    val response = container.backend.discover(listId, filters, next)
                    mutableState.update {
                        it.copy(
                            results = DiscoverResults.append(it.results, response.results),
                            page = response.page,
                            totalPages = response.totalPages,
                            loadingMore = false
                        )
                    }
                } catch (error: BackendException) {
                    mutableState.update { it.copy(loadingMore = false, error = searchFailure(error)) }
                }
            }
    }

    private fun search(debounceMs: Long) {
        searchJob?.cancel()
        mutableState.update { it.copy(loading = true, loadingMore = false, error = null) }
        searchJob =
            viewModelScope.launch {
                if (debounceMs > 0) delay(debounceMs)
                val filters = mutableState.value.filters
                try {
                    val response = container.backend.discover(listId, filters, 1)
                    mutableState.update {
                        it.copy(
                            results = DiscoverResults.append(emptyList(), response.results),
                            page = response.page,
                            totalPages = response.totalPages,
                            loading = false
                        )
                    }
                } catch (error: BackendException) {
                    mutableState.update {
                        it.copy(
                            results = emptyList(),
                            page = 0,
                            totalPages = 0,
                            loading = false,
                            error = searchFailure(error)
                        )
                    }
                }
            }
    }

    private fun interpretFailure(error: BackendException): String = when {
        error.code == BackendErrorCode.RATE_LIMITED || error.status == 429 ->
            "Vocês já usaram as interpretações de hoje. Os filtros abaixo continuam funcionando; amanhã volta."

        error.code == BackendErrorCode.NETWORK ->
            "Sem internet para interpretar a frase. Use os filtros abaixo."

        error.code == BackendErrorCode.INVALID_INPUT ->
            "A frase precisa ter de 2 a $INTERPRET_MAX_LENGTH caracteres."

        else -> "O Gemini não respondeu agora. Use os filtros abaixo."
    }

    private fun searchFailure(error: BackendException): String = if (error.code == BackendErrorCode.NETWORK) {
        "Sem internet: a busca avançada precisa de conexão."
    } else {
        "Não deu para buscar agora."
    }
}
