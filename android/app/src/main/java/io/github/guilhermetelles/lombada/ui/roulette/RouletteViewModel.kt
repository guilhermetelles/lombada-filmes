package io.github.guilhermetelles.lombada.ui.roulette

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.model.Movie
import io.github.guilhermetelles.lombada.data.model.QueueItem
import io.github.guilhermetelles.lombada.data.model.RecItem
import io.github.guilhermetelles.lombada.data.model.RecsDoc
import io.github.guilhermetelles.lombada.domain.MovieTitles
import io.github.guilhermetelles.lombada.domain.QueueLines
import io.github.guilhermetelles.lombada.domain.Roulette
import io.github.guilhermetelles.lombada.domain.RouletteFilm
import io.github.guilhermetelles.lombada.domain.RouletteFilter
import io.github.guilhermetelles.lombada.domain.RoulettePool
import io.github.guilhermetelles.lombada.domain.RouletteSource
import io.github.guilhermetelles.lombada.domain.TitleLanguage
import io.github.guilhermetelles.lombada.ui.SCREEN_SHARING
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Candidatos lidos do banco, antes dos filtros.
 *
 * @property queue Filmes da fila (sem os da lista).
 * @property suggestions Sugestões de `recs/current` (sem os da lista e os recusados).
 */
private data class RouletteData(val queue: List<RouletteFilm>, val suggestions: List<RouletteFilm>)

/**
 * Estado do sorteio.
 *
 * @property loading Se a fila e as sugestões ainda não chegaram.
 * @property filters Filtros ligados.
 * @property pool Candidatos com os filtros.
 * @property queueSize Filmes na fila, sem filtro.
 * @property pick Filme sorteado.
 * @property rollId Muda a cada sorteio, para a tela animar.
 */
data class RouletteUiState(
    val loading: Boolean = true,
    val filters: Set<RouletteFilter> = emptySet(),
    val pool: RoulettePool = RoulettePool(RouletteSource.Queue, emptyList()),
    val queueSize: Int = 0,
    val pick: RouletteFilm? = null,
    val rollId: Int = 0
)

private data class Roll(val pick: RouletteFilm? = null, val id: Int = 0)

/**
 * "O que vamos ver hoje?": sorteia da fila, ou das sugestões quando a fila (com os filtros) não tem
 * nada. Os filtros valem sobre os dados de `movies/` (duração, gêneros, nota e votos do TMDb,
 * streaming no Brasil) e, nas sugestões, sobre o que `recs/current` traz.
 *
 * @param container Dependências do app.
 * @param listId Lista ativa.
 * @param inList Filmes que já são entradas da lista.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class RouletteViewModel(private val container: AppContainer, listId: String, inList: Flow<Set<Int>>) : ViewModel() {
    private val filters = MutableStateFlow<Set<RouletteFilter>>(emptySet())
    private val roll = MutableStateFlow(Roll())

    private val recs: Flow<RecsDoc?> = container.recs.observe(listId).onStart { emit(null) }.catch { emit(null) }

    private val queueItems: Flow<List<QueueItem>> =
        combine(container.queue.observe(listId), inList) { queue, entries -> QueueLines.visible(queue, entries) }

    private val data: Flow<RouletteData?> =
        combine(
            queueItems.flatMapLatest { items ->
                container.movies.observeMany(items.map { it.tmdbId }).map { movies -> items to movies }
            },
            recs,
            inList,
            container.dismissed.observe(listId).onStart { emit(emptySet()) }.catch { emit(emptySet()) },
            container.titleLanguage.language
        ) { (items, movies), doc, entries, dismissed, language ->
            val recById = doc?.let { it.items + it.trending }.orEmpty().associateBy { it.tmdbId }
            val queue = items.mapNotNull { item ->
                movies[item.tmdbId]?.toFilm(recById[item.tmdbId], item.addedBy, language)
            }
            val suggestions =
                doc
                    ?.let { it.items + it.trending }
                    .orEmpty()
                    .filter { it.tmdbId !in entries && it.tmdbId !in dismissed }
                    .sortedByDescending { it.score }
                    .map { it.toFilm(language) }
            RouletteData(queue, suggestions)
        }.onEach { latest = it }
            .onStart<RouletteData?> { emit(null) }
            .catch { emit(RouletteData(emptyList(), emptyList())) }

    // Últimos candidatos lidos, para sortear sem esperar o estado da tela.
    @Volatile
    private var latest: RouletteData? = null

    /** Estado da tela. */
    val state: StateFlow<RouletteUiState> =
        combine(data, filters, roll) { loaded, active, current ->
            if (loaded == null) return@combine RouletteUiState(filters = active)
            RouletteUiState(
                loading = false,
                filters = active,
                pool = Roulette.candidates(loaded.queue, loaded.suggestions, active),
                queueSize = loaded.queue.size,
                pick = current.pick,
                rollId = current.id
            )
        }.distinctUntilChanged()
            .stateIn(viewModelScope, SCREEN_SHARING, RouletteUiState())

    init {
        // Primeiro sorteio assim que a fila e as sugestões chegam.
        viewModelScope.launch {
            state.filter { !it.loading }.first()
            spin()
        }
    }

    /**
     * Liga ou desliga um filtro e sorteia de novo.
     *
     * @param filter Filtro.
     */
    fun toggle(filter: RouletteFilter) {
        filters.update { if (filter in it) it - filter else it + filter }
        roll.update { Roll(null, it.id) }
        spin()
    }

    /** Sorteia de novo, evitando repetir o anterior. */
    fun spin() {
        val loaded = latest ?: return
        val pool = Roulette.candidates(loaded.queue, loaded.suggestions, filters.value)
        roll.update { previous -> Roll(Roulette.pick(pool.films, previous.pick?.tmdbId), previous.id + 1) }
    }

    private fun Movie.toFilm(rec: RecItem?, addedBy: String, language: TitleLanguage) = RouletteFilm(
        tmdbId = tmdbId,
        title = MovieTitles.of(this, language),
        year = year,
        posterPath = posterPath,
        runtime = runtime,
        genres = genres,
        vote = vote,
        votes = votes,
        providers = providersBR?.flatrate.orEmpty(),
        score = rec?.score,
        reason = rec?.reason,
        addedBy = addedBy
    )

    private fun RecItem.toFilm(language: TitleLanguage) = RouletteFilm(
        tmdbId = tmdbId,
        title = MovieTitles.of(this, language),
        year = year,
        posterPath = posterPath,
        runtime = runtime,
        genres = genres,
        vote = null,
        votes = null,
        providers = providers,
        score = score,
        reason = reason.takeIf { it.isNotBlank() },
        addedBy = null
    )
}
