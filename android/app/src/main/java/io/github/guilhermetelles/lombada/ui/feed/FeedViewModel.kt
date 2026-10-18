package io.github.guilhermetelles.lombada.ui.feed

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.model.FeedItem
import io.github.guilhermetelles.lombada.domain.FeedFilter
import java.time.Instant
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Estado da Atividade.
 *
 * @property loading Se os itens ainda não chegaram.
 * @property items Itens, do mais novo para o mais antigo.
 * @property filter Filtro escolhido.
 * @property seenBefore Quando a pessoa tinha aberto a Atividade antes desta vez; os mais novos ficam destacados.
 */
data class FeedState(
    val loading: Boolean = true,
    val items: List<FeedItem> = emptyList(),
    val filter: FeedFilter = FeedFilter.All,
    val seenBefore: Instant? = null
)

// Quanto esperar o perfil (do cache) para saber o que é novidade.
private const val SEEN_TIMEOUT_MS = 3_000L

/**
 * Atividade da lista: os itens de `feed/` em tempo real e o filtro. Ao abrir, guarda quando a
 * pessoa tinha visto pela última vez (para destacar as novidades) e marca tudo como visto, o que
 * zera o sino. Ao fechar, marca de novo, para o que chegou com a tela aberta também contar como visto.
 *
 * @param container Dependências do app.
 * @param listId Lista ativa.
 * @param uid Pessoa logada.
 */
class FeedViewModel(private val container: AppContainer, private val listId: String, private val uid: String) :
    ViewModel() {
    private val filter = MutableStateFlow(FeedFilter.All)
    private val seenBefore = MutableStateFlow<Instant?>(null)

    init {
        viewModelScope.launch {
            seenBefore.value =
                withTimeoutOrNull(SEEN_TIMEOUT_MS) {
                    runCatching { container.users.observeFeedSeenAt(uid, listId).first() }.getOrNull()
                }
            markSeen()
        }
    }

    /** Estado da tela. */
    val state: StateFlow<FeedState> =
        combine(
            container.feed.observe(listId).catch { emit(emptyList()) },
            filter,
            seenBefore
        ) { items, chosen, seen ->
            FeedState(loading = false, items = items, filter = chosen, seenBefore = seen)
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), FeedState())

    /**
     * Troca o filtro.
     *
     * @param value Filtro escolhido.
     */
    fun setFilter(value: FeedFilter) {
        filter.value = value
    }

    override fun onCleared() {
        // No escopo do app: a tela já foi embora, mas a gravação precisa sair.
        container.appScope.launch { markSeen() }
    }

    private suspend fun markSeen() {
        runCatching { container.users.markFeedSeen(uid, listId) }
    }
}
