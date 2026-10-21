package io.github.guilhermetelles.lombada.ui.person

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.backend.BackendErrorCode
import io.github.guilhermetelles.lombada.data.backend.BackendException
import io.github.guilhermetelles.lombada.data.model.Person
import io.github.guilhermetelles.lombada.domain.PersonFilm
import io.github.guilhermetelles.lombada.domain.PersonInList
import io.github.guilhermetelles.lombada.ui.SCREEN_SHARING
import io.github.guilhermetelles.lombada.ui.detail.RefreshStatus
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/**
 * Estado da tela da pessoa.
 *
 * @property person Ficha completa, quando já buscada.
 * @property films Filmes da lista com a pessoa, na hora, a partir dos filmes.
 * @property photo Foto: da ficha ou, antes dela, a dos filmes.
 * @property refresh Andamento de `GET /api/people/{id}`.
 */
data class PersonUiState(
    val person: Person? = null,
    val films: List<PersonFilm> = emptyList(),
    val photo: String? = null,
    val refresh: RefreshStatus = RefreshStatus.Refreshing
)

/**
 * Tela da pessoa em duas etapas: na hora, nome, foto e "Na lista de vocês" a partir dos filmes da
 * lista, já no cache; depois, `GET /api/people/{id}` em toda abertura completa a ficha.
 *
 * @param container Dependências do app.
 * @param listId Lista ativa.
 * @param personId Pessoa.
 * @param knownPhoto Foto que veio junto com o toque, se houver.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PersonViewModel(
    private val container: AppContainer,
    listId: String,
    private val personId: Int,
    knownPhoto: String?
) : ViewModel() {
    private val refresh = MutableStateFlow(RefreshStatus.Refreshing)
    private val ranking = container.rankings.observe(listId)
    private val movies =
        ranking
            .map { entries -> entries.map { it.tmdbId }.toSet() }
            .distinctUntilChanged()
            .flatMapLatest { container.movies.observeMany(it) }

    /** Estado da tela. */
    val state: StateFlow<PersonUiState> =
        // A ficha começa como "ainda não buscada": sem rede, o listener de um documento que nunca veio
        // ao celular só responde depois de desistir do servidor, e a tela não pode esperar por ele.
        combine(
            container.people.observe(personId).onStart {
                emit(null)
            },
            ranking,
            movies,
            refresh
        ) { person, entries, byId, status ->
            PersonUiState(
                person = person,
                films = PersonInList.films(personId, entries, byId.mapValues { it.value.cast }),
                photo = person?.profilePath ?: knownPhoto ?: PersonInList.photo(personId, byId.values),
                refresh = status
            )
        }.stateIn(viewModelScope, SCREEN_SHARING, PersonUiState(photo = knownPhoto))

    init {
        retry()
    }

    /** Pede a ficha ao backend de novo. */
    fun retry() {
        refresh.value = RefreshStatus.Refreshing
        viewModelScope.launch {
            refresh.value =
                try {
                    container.backend.refreshPerson(personId)
                    RefreshStatus.Done
                } catch (error: BackendException) {
                    if (error.code == BackendErrorCode.NETWORK) RefreshStatus.Offline else RefreshStatus.Failed
                }
        }
    }
}
