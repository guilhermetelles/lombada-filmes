package io.github.guilhermetelles.lombada.ui.feed

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.model.FeedItem
import io.github.guilhermetelles.lombada.domain.FeedFilter
import io.github.guilhermetelles.lombada.domain.FeedPeriod
import io.github.guilhermetelles.lombada.domain.FeedPeriods
import io.github.guilhermetelles.lombada.ui.SCREEN_SHARING
import java.time.Instant
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Estado da Atividade.
 *
 * @property loading Se os itens ainda não chegaram.
 * @property items Itens do período, do mais novo para o mais antigo.
 * @property filter Tipo escolhido.
 * @property period Período escolhido.
 * @property since Corte do período em uso; null não corta.
 * @property hasMore Se a consulta bateu no limite e pode haver itens mais antigos.
 * @property seenBefore Quando a pessoa tinha aberto a Atividade antes desta vez; os mais novos ficam destacados.
 */
data class FeedState(
    val loading: Boolean = true,
    val items: List<FeedItem> = emptyList(),
    val filter: FeedFilter = FeedFilter.All,
    val period: FeedPeriod = FeedPeriod.DEFAULT,
    val since: Instant? = null,
    val hasMore: Boolean = false,
    val seenBefore: Instant? = null
)

// Quanto esperar o perfil (do cache) para saber o que é novidade.
private const val SEEN_TIMEOUT_MS = 3_000L

// Itens por página; "Carregar mais" soma outra página ao limite.
private const val PAGE_SIZE = 100L

/** `feedSeenAt` de antes desta visita; [loaded] fica true quando a leitura termina (com ou sem valor). */
private data class SeenBefore(val loaded: Boolean = false, val at: Instant? = null)

/** Consulta em uso: o corte já calculado e o limite. */
private data class FeedQuery(val since: Instant?, val limit: Long)

/** Itens que chegaram para uma consulta. */
private data class FeedPage(val query: FeedQuery, val items: List<FeedItem>)

/**
 * Atividade da lista: os itens de `feed/` em tempo real, o filtro de tipo e o de período. Ao abrir,
 * guarda quando a pessoa tinha visto pela última vez (para destacar as novidades e para o período
 * "Novas") e marca tudo como visto, o que zera o sino. Ao fechar, marca de novo, para o que chegou com
 * a tela aberta também contar como visto.
 *
 * @param container Dependências do app.
 * @param periodStore Onde o período escolhido fica guardado no aparelho.
 * @param listId Lista ativa.
 * @param uid Pessoa logada.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class FeedViewModel(
    private val container: AppContainer,
    private val periodStore: FeedPeriodStore,
    private val listId: String,
    private val uid: String
) : ViewModel() {
    private val filter = MutableStateFlow(FeedFilter.All)
    private val period = MutableStateFlow(periodStore.read())
    private val seenBefore = MutableStateFlow(SeenBefore())
    private val limit = MutableStateFlow(PAGE_SIZE)

    init {
        viewModelScope.launch {
            val at =
                withTimeoutOrNull(SEEN_TIMEOUT_MS) {
                    runCatching { container.users.observeFeedSeenAt(uid, listId).first() }.getOrNull()
                }
            seenBefore.value = SeenBefore(loaded = true, at = at)
            markSeen()
        }
    }

    // "Novas" espera o feedSeenAt de antes; os outros períodos não dependem dele.
    private val query =
        combine(period, seenBefore, limit) { chosen, seen, max ->
            Triple(chosen, if (chosen == FeedPeriod.New) seen else null, max)
        }.distinctUntilChanged()
            .map { (chosen, seen, max) ->
                if (seen != null && !seen.loaded) {
                    null
                } else {
                    FeedQuery(FeedPeriods.since(chosen, Instant.now(), seen?.at), max)
                }
            }

    private val page =
        query.flatMapLatest { current ->
            if (current == null) {
                flowOf(null)
            } else {
                container.feed
                    .observe(listId, current.since, current.limit)
                    .catch { emit(emptyList()) }
                    .map<List<FeedItem>, FeedPage?> { FeedPage(current, it) }
                    // Período novo mostra o carregamento; "Carregar mais" mantém a lista até a página chegar.
                    .onStart { if (current.limit == PAGE_SIZE) emit(null) }
            }
        }

    /** Estado da tela. */
    val state: StateFlow<FeedState> =
        combine(page, filter, period, seenBefore) { loaded, kind, chosen, seen ->
            FeedState(
                loading = loaded == null,
                items = loaded?.items.orEmpty(),
                filter = kind,
                period = chosen,
                since = loaded?.query?.since,
                hasMore = loaded != null && loaded.items.size >= loaded.query.limit,
                seenBefore = seen.at
            )
        }.stateIn(viewModelScope, SCREEN_SHARING, FeedState(period = period.value))

    /**
     * Troca o tipo.
     *
     * @param value Tipo escolhido.
     */
    fun setFilter(value: FeedFilter) {
        filter.value = value
    }

    /**
     * Troca o período, guarda a escolha no aparelho e volta à primeira página.
     *
     * @param value Período escolhido.
     */
    fun setPeriod(value: FeedPeriod) {
        if (value == period.value) return
        periodStore.save(value)
        limit.value = PAGE_SIZE
        period.value = value
    }

    /** Busca mais uma página de itens antigos. */
    fun loadMore() {
        limit.value += PAGE_SIZE
    }

    override fun onCleared() {
        // No escopo do app: a tela já foi embora, mas a gravação precisa sair.
        container.appScope.launch { markSeen() }
    }

    private suspend fun markSeen() {
        runCatching { container.users.markFeedSeen(uid, listId) }
    }
}
