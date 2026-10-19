package io.github.guilhermetelles.lombada.ui.listinfo

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.backend.BackendErrorCode
import io.github.guilhermetelles.lombada.data.backend.BackendException
import io.github.guilhermetelles.lombada.data.model.Scores
import java.time.Instant
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Código de convite gerado nesta tela.
 *
 * @property code Código normalizado.
 * @property expiresAt Validade, quando o backend mandou.
 */
data class GeneratedInvite(val code: String, val expiresAt: Instant?)

/**
 * Estado do convite.
 *
 * @property generating Se o pedido está em andamento.
 * @property invite Último código gerado.
 */
data class InviteState(val generating: Boolean = false, val invite: GeneratedInvite? = null)

// Placares guardados que a tela olha: dez anos de meses, documentos pequenos.
private const val SCORE_MONTHS = 120

private const val TAG = "ListInfo"

/**
 * Detalhes da lista: placares de todos os meses e o código de convite.
 *
 * @param container Dependências do app.
 * @param listId Lista ativa.
 */
class ListInfoViewModel(private val container: AppContainer, private val listId: String) : ViewModel() {
    /** Placares guardados, do mês mais recente para o mais antigo; null enquanto carrega. */
    val history: StateFlow<List<Scores>?> =
        container.scores
            .observeRecent(listId, SCORE_MONTHS)
            .map<List<Scores>, List<Scores>?> { it }
            .catch { error ->
                // Sem placar a tela mostra zero; o motivo fica no log para não sumir em silêncio.
                Log.w(TAG, "Placares não carregados", error)
                emit(emptyList())
            }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    private val _invite = MutableStateFlow(InviteState())

    /** Estado do convite. */
    val invite: StateFlow<InviteState> = _invite.asStateFlow()

    /** Gera um código novo (`POST /api/lists/{id}/invites`), que vale 7 dias. */
    fun generateInvite() {
        if (_invite.value.generating) return
        _invite.update { it.copy(generating = true) }
        viewModelScope.launch {
            try {
                val created = container.backend.createInvite(listId)
                val expires = runCatching { Instant.parse(created.expiresAt) }.getOrNull()
                _invite.value = InviteState(invite = GeneratedInvite(created.inviteCode, expires))
            } catch (error: BackendException) {
                _invite.update { it.copy(generating = false) }
                val text =
                    if (error.code == BackendErrorCode.NETWORK) {
                        "Sem conexão. Confira a internet para gerar o código."
                    } else {
                        "Não deu para gerar o código. Tente de novo."
                    }
                container.appScope.launch { container.snackbar.showSnackbar(text) }
            }
        }
    }
}
