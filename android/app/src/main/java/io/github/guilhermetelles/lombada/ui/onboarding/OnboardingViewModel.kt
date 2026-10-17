package io.github.guilhermetelles.lombada.ui.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.backend.BackendErrorCode
import io.github.guilhermetelles.lombada.data.backend.BackendException
import io.github.guilhermetelles.lombada.domain.InviteCode
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Estado dos dois cards de "Como vocês querem começar?" e da tela "Lista criada".
 *
 * @property code Código digitado, já formatado (`ABC-123`).
 * @property codeError Erro do código, ou null.
 * @property joining Se a entrada está em andamento.
 * @property name Nome da lista nova.
 * @property nameError Erro do nome, ou null.
 * @property description Descrição da lista nova.
 * @property creating Se a criação está em andamento.
 * @property created Lista recém-criada, para mostrar o código.
 */
data class OnboardingUiState(
    val code: String = "",
    val codeError: String? = null,
    val joining: Boolean = false,
    val name: String = "",
    val nameError: String? = null,
    val description: String = "",
    val creating: Boolean = false,
    val created: CreatedList? = null
)

/**
 * Lista que acabou de ser criada.
 *
 * @property listId Id da lista.
 * @property inviteCode Código para convidar, sem traço.
 */
data class CreatedList(val listId: String, val inviteCode: String)

/**
 * Entrar com código (`POST /api/lists/join`) e criar lista (`POST /api/lists`).
 *
 * @param container Dependências do app.
 * @param uid Pessoa logada.
 * @param onHoldNewList Avisa a sessão para segurar a lista nova enquanto o código aparece.
 * @param onMessage Mostra uma mensagem curta (snackbar).
 */
class OnboardingViewModel(
    private val container: AppContainer,
    private val uid: String,
    private val onHoldNewList: (Boolean) -> Unit,
    private val onMessage: (String) -> Unit
) : ViewModel() {
    private val _state = MutableStateFlow(OnboardingUiState())

    /** Estado da tela. */
    val state: StateFlow<OnboardingUiState> = _state.asStateFlow()

    /**
     * Atualiza o código digitado, formatando e limpando o erro.
     *
     * @param typed Texto do campo.
     */
    fun onCodeChange(typed: String) {
        val code = InviteCode.normalize(typed).take(InviteCode.LENGTH)
        _state.update { it.copy(code = InviteCode.format(code), codeError = null) }
    }

    /**
     * Atualiza o nome da lista nova.
     *
     * @param name Texto do campo.
     */
    fun onNameChange(name: String) {
        _state.update { it.copy(name = name.take(80), nameError = null) }
    }

    /**
     * Atualiza a descrição da lista nova.
     *
     * @param description Texto do campo.
     */
    fun onDescriptionChange(description: String) {
        _state.update { it.copy(description = description.take(280)) }
    }

    /** Entra na lista do código digitado. */
    fun join() {
        val code = InviteCode.normalize(_state.value.code)
        if (!InviteCode.isWellFormed(code)) {
            _state.update { it.copy(codeError = "O código tem 6 letras e números, como 7Q4-KMX.") }
            return
        }
        if (_state.value.joining) return
        _state.update { it.copy(joining = true) }
        viewModelScope.launch {
            try {
                val joined = container.backend.joinList(code)
                container.users.visit(uid, joined.listId)
                onMessage(
                    if (joined.alreadyMember) "Você já está em ${joined.name}" else "Você entrou em ${joined.name}"
                )
                _state.update { OnboardingUiState() }
            } catch (error: BackendException) {
                _state.update { it.copy(joining = false, codeError = joinErrorMessage(error.code)) }
            } catch (error: Exception) {
                _state.update {
                    it.copy(joining = false, codeError = "Não deu para entrar agora. Tente de novo em instantes.")
                }
            }
        }
    }

    /** Cria a lista com o nome e a descrição digitados. */
    fun create() {
        val name = _state.value.name.trim()
        if (name.isEmpty()) {
            _state.update { it.copy(nameError = "Dê um nome para a lista.") }
            return
        }
        if (_state.value.creating) return
        _state.update { it.copy(creating = true) }
        onHoldNewList(true)
        viewModelScope.launch {
            try {
                val created = container.backend.createList(name, _state.value.description.trim())
                _state.update { it.copy(creating = false, created = CreatedList(created.listId, created.inviteCode)) }
            } catch (error: Exception) {
                onHoldNewList(false)
                val message =
                    if (error is BackendException && error.code == BackendErrorCode.NETWORK) {
                        "Sem internet. Confira a conexão e tente de novo."
                    } else {
                        "Não deu para criar a lista agora. Tente de novo em instantes."
                    }
                _state.update { it.copy(creating = false, nameError = message) }
            }
        }
    }

    /** Abre a lista recém-criada. */
    fun openCreated() {
        val created = _state.value.created ?: return
        viewModelScope.launch {
            runCatching { container.users.visit(uid, created.listId) }
            onHoldNewList(false)
        }
    }

    private fun joinErrorMessage(code: BackendErrorCode): String = when (code) {
        BackendErrorCode.NOT_FOUND -> "Nenhuma lista com esse código. Confira as letras ou peça um código novo."
        BackendErrorCode.INVITE_EXPIRED -> "Esse código venceu. Peça um código novo para quem está na lista."
        BackendErrorCode.INVALID_INPUT -> "O código tem 6 letras e números, como 7Q4-KMX."
        BackendErrorCode.NETWORK -> "Sem internet. Confira a conexão e tente de novo."
        else -> "Não deu para entrar agora. Tente de novo em instantes."
    }
}
