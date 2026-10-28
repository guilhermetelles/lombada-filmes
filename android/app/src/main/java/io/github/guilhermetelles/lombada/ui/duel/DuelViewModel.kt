package io.github.guilhermetelles.lombada.ui.duel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.backend.BackendErrorCode
import io.github.guilhermetelles.lombada.data.backend.BackendException
import io.github.guilhermetelles.lombada.data.backend.DuelView
import io.github.guilhermetelles.lombada.data.model.Duel
import io.github.guilhermetelles.lombada.data.model.DuelChoice
import io.github.guilhermetelles.lombada.data.model.DuelStatus
import io.github.guilhermetelles.lombada.ui.SCREEN_SHARING
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Por que o duelo não abriu. */
enum class DuelLoadError {
    /** Menos de dois filmes na lista. */
    NO_FILMS,

    /** Sem internet. */
    NETWORK,

    /** Qualquer outra falha. */
    OTHER
}

/**
 * Estado da tela do duelo.
 *
 * @property loading Se o duelo ainda está abrindo.
 * @property loadError Por que não abriu, ou null.
 * @property duel Duelo do dia, com os votos.
 * @property sending Voto enviado, esperando o backend.
 */
data class DuelUiState(
    val loading: Boolean = true,
    val loadError: DuelLoadError? = null,
    val duel: Duel? = null,
    val sending: DuelChoice? = null
)

private data class OpenState(val loading: Boolean = true, val error: DuelLoadError? = null, val duel: Duel? = null)

/**
 * Duelo de revisão: abre o duelo de hoje pelo backend (`GET …/duel`, com o par da notificação), acompanha
 * os votos pelo Firestore e vota (`POST …/duel/{dia}/vote`). Quem troca as entradas é o backend, quando
 * todos votam para trocar.
 *
 * @param container Dependências do app.
 * @param listId Lista ativa.
 * @param entryIdA Entrada da frente, vinda da rota da notificação.
 * @param entryIdB A outra entrada, vinda da rota da notificação.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class DuelViewModel(
    private val container: AppContainer,
    private val listId: String,
    private val entryIdA: String?,
    private val entryIdB: String?
) : ViewModel() {
    // O que o backend devolveu por último (abertura ou voto), até o Firestore alcançar.
    private val opened = MutableStateFlow(OpenState())
    private val sending = MutableStateFlow<DuelChoice?>(null)

    /** Estado da tela. */
    val state: StateFlow<DuelUiState> =
        combine(
            opened.flatMapLatest { open ->
                val day = open.duel?.day ?: return@flatMapLatest flowOf(open to null)
                container.duels.observe(listId, day).catch { emit(null) }.map { live -> open to live }
            },
            sending
        ) { (open, live), vote ->
            DuelUiState(
                loading = open.loading,
                loadError = open.error,
                duel = newest(open.duel, live),
                sending = vote
            )
        }.stateIn(viewModelScope, SCREEN_SHARING, DuelUiState())

    init {
        open()
    }

    /** Abre (ou tenta abrir de novo) o duelo de hoje. */
    fun open() {
        opened.value = OpenState()
        viewModelScope.launch {
            opened.value =
                try {
                    OpenState(loading = false, duel = container.backend.getDuel(listId, entryIdA, entryIdB).toDuel())
                } catch (error: BackendException) {
                    val reason =
                        when (error.code) {
                            BackendErrorCode.NOT_FOUND -> DuelLoadError.NO_FILMS
                            BackendErrorCode.NETWORK -> DuelLoadError.NETWORK
                            else -> DuelLoadError.OTHER
                        }
                    OpenState(loading = false, error = reason)
                }
        }
    }

    /**
     * Vota no duelo aberto.
     *
     * @param choice Manter ou trocar.
     */
    fun vote(choice: DuelChoice) {
        val duel = state.value.duel ?: return
        if (duel.status != DuelStatus.OPEN || sending.value != null) return
        sending.value = choice
        viewModelScope.launch {
            try {
                val after = container.backend.voteDuel(listId, duel.day, choice.wire).toDuel()
                opened.update { it.copy(duel = after) }
            } catch (error: BackendException) {
                container.snackbar.showSnackbar(voteFailure(error.code))
            } finally {
                sending.value = null
            }
        }
    }

    private fun voteFailure(code: BackendErrorCode): String = when (code) {
        BackendErrorCode.NETWORK -> "Sem internet: seu voto não foi enviado."
        BackendErrorCode.CONFLICT -> "Não deu para votar: o duelo já fechou ou um dos filmes saiu da lista."
        BackendErrorCode.NOT_TODAY -> "O dia virou: esse duelo já fechou."
        else -> "Não deu para votar agora. Tente de novo em instantes."
    }
}

/**
 * Escolhe a versão mais nova do duelo entre a resposta do backend e o documento do Firestore, que pode
 * chegar atrasado logo depois de um voto.
 *
 * @param fromBackend O que o backend devolveu por último.
 * @param live O documento do Firestore.
 * @return A versão mais avançada (fechada antes de aberta; mais votos antes de menos).
 */
internal fun newest(fromBackend: Duel?, live: Duel?): Duel? {
    if (fromBackend == null || live == null) return live ?: fromBackend
    if (live.status != DuelStatus.OPEN) return live
    if (fromBackend.status != DuelStatus.OPEN) return fromBackend
    return if (live.votes.size >= fromBackend.votes.size) live else fromBackend
}

private fun DuelView.toDuel(): Duel = Duel(
    day = day,
    entryIdA = entryIdA,
    entryIdB = entryIdB,
    status = DuelStatus.fromWire(status) ?: DuelStatus.OPEN,
    votes = votes.mapNotNull { (uid, vote) -> DuelChoice.fromWire(vote)?.let { uid to it } }.toMap()
)
