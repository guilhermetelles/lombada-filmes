package io.github.guilhermetelles.lombada.ui.reports

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.domain.Bar
import io.github.guilhermetelles.lombada.domain.BechdelReport
import io.github.guilhermetelles.lombada.domain.Calendar
import io.github.guilhermetelles.lombada.domain.Reports
import io.github.guilhermetelles.lombada.domain.Summary
import io.github.guilhermetelles.lombada.domain.TopActors
import java.time.LocalDate
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

/**
 * Tudo o que a tela de relatórios mostra.
 *
 * @property loading Se a lista ainda não chegou.
 * @property ranking Entradas na ordem do ranking.
 * @property summary Resumo.
 * @property recent Os 5 últimos vistos, para a prévia da comparação.
 * @property calendar Filmes por mês.
 * @property directors Diretores mais vistos.
 * @property actors Atores mais vistos.
 * @property bechdel Teste de Bechdel; null sem nenhum filme avaliado.
 * @property genres Gêneros.
 * @property decades Décadas.
 */
data class ReportsUiState(
    val loading: Boolean = true,
    val ranking: List<Entry> = emptyList(),
    val summary: Summary? = null,
    val recent: List<Entry> = emptyList(),
    val calendar: Calendar? = null,
    val directors: List<Bar> = emptyList(),
    val actors: TopActors? = null,
    val bechdel: BechdelReport? = null,
    val genres: List<Bar> = emptyList(),
    val decades: List<Bar> = emptyList()
)

/**
 * Relatórios calculados no app a partir das entradas e de `movies/` dos filmes da lista.
 *
 * @param container Dependências do app.
 * @param listId Lista ativa.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ReportsViewModel(container: AppContainer, listId: String) : ViewModel() {
    private val ranking = container.entries.observeRanking(listId)
    private val movies =
        ranking
            .map { entries -> entries.map { it.tmdbId }.toSet() }
            .distinctUntilChanged()
            .flatMapLatest { container.movies.observeMany(it) }

    /** Estado da tela. */
    val state: StateFlow<ReportsUiState> =
        combine(ranking, movies) { entries, byId ->
            ReportsUiState(
                loading = false,
                ranking = entries,
                summary = Reports.summary(entries, byId),
                recent = Reports.recent(entries),
                calendar = Reports.calendar(entries, LocalDate.now()),
                directors = Reports.directors(entries, byId),
                actors = Reports.actors(entries, byId),
                bechdel = Reports.bechdel(entries, byId),
                genres = Reports.genres(entries, byId),
                decades = Reports.decades(entries)
            )
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), ReportsUiState())
}
