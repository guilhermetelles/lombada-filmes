package io.github.guilhermetelles.lombada.ui.lists

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.backend.BackendErrorCode
import io.github.guilhermetelles.lombada.data.backend.BackendException
import io.github.guilhermetelles.lombada.data.model.MovieList
import java.time.Instant
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Código gerado para convidar.
 *
 * @property listId Lista.
 * @property code Código sem traço.
 * @property expiresAt Validade.
 */
data class InviteCodeShown(val listId: String, val code: String, val expiresAt: Instant?)

/**
 * Estado de "Suas listas".
 *
 * @property counts Quantidade de filmes de cada lista, quando já contada.
 * @property invite Último código gerado.
 * @property generating Se o código está sendo gerado.
 * @property busyListId Lista saindo ou sendo apagada.
 */
data class ListsUiState(
    val counts: Map<String, Long> = emptyMap(),
    val invite: InviteCodeShown? = null,
    val generating: Boolean = false,
    val busyListId: String? = null
)

/**
 * Seletor de listas: contar filmes, gerar código para convidar, sair, apagar e editar nome e
 * descrição.
 *
 * @param container Dependências do app.
 * @param uid Pessoa logada.
 */
class ListsViewModel(private val container: AppContainer, private val uid: String) : ViewModel() {
    private val _state = MutableStateFlow(ListsUiState())

    /** Estado da folha. */
    val state: StateFlow<ListsUiState> = _state.asStateFlow()

    /**
     * Conta os filmes das listas com `count()`; sem rede, a contagem fica de fora.
     *
     * @param lists Listas da pessoa.
     */
    fun loadCounts(lists: List<MovieList>) {
        lists.forEach { list ->
            viewModelScope.launch {
                runCatching { container.lists.countEntries(list.id) }.onSuccess { count ->
                    _state.update { it.copy(counts = it.counts + (list.id to count)) }
                }
            }
        }
    }

    /**
     * Gera um código novo para a lista (`POST /api/lists/{id}/invites`).
     *
     * @param listId Lista.
     */
    fun generateInvite(listId: String) {
        if (_state.value.generating) return
        _state.update { it.copy(generating = true) }
        viewModelScope.launch {
            try {
                val created = container.backend.createInvite(listId)
                val expires = runCatching { Instant.parse(created.expiresAt) }.getOrNull()
                _state.update {
                    it.copy(generating = false, invite = InviteCodeShown(listId, created.inviteCode, expires))
                }
            } catch (error: BackendException) {
                _state.update { it.copy(generating = false) }
                message(failure(error, "gerar o código"))
            }
        }
    }

    /**
     * Sai da lista (`POST /api/lists/{id}/leave`) e a tira do perfil.
     *
     * @param list Lista.
     */
    fun leave(list: MovieList) {
        runBusy(list.id) {
            val result = container.backend.leaveList(list.id)
            container.users.forget(uid, list.id)
            message(
                if (result.listDeleted) {
                    "Você saiu, e ${list.name} foi apagada por ficar sem ninguém"
                } else {
                    "Você saiu de ${list.name}"
                }
            )
        }
    }

    /**
     * Apaga a lista (`DELETE /api/lists/{id}`), só para quem é dono.
     *
     * @param list Lista.
     */
    fun delete(list: MovieList) {
        runBusy(list.id) {
            container.backend.deleteList(list.id)
            container.users.forget(uid, list.id)
            message("${list.name} foi apagada")
        }
    }

    /**
     * Edita nome e descrição da lista direto no Firestore.
     *
     * @param list Lista.
     * @param name Nome novo.
     * @param description Descrição nova.
     */
    fun rename(list: MovieList, name: String, description: String) {
        viewModelScope.launch {
            runCatching { container.lists.updateDetails(list.id, name.trim().take(80), description.trim().take(280)) }
                .onFailure { message("Não deu para salvar o nome da lista.") }
        }
    }

    private fun runBusy(listId: String, block: suspend () -> Unit) {
        if (_state.value.busyListId != null) return
        _state.update { it.copy(busyListId = listId) }
        viewModelScope.launch {
            try {
                block()
            } catch (error: BackendException) {
                message(failure(error, "concluir"))
            } finally {
                _state.update { it.copy(busyListId = null) }
            }
        }
    }

    private fun failure(error: BackendException, action: String): String = when (error.code) {
        BackendErrorCode.NETWORK -> "Sem internet para $action."
        BackendErrorCode.FORBIDDEN -> "Só quem é dono da lista pode apagá-la."
        BackendErrorCode.NOT_FOUND -> "Essa lista não existe mais."
        else -> "Não deu para $action agora. Tente de novo."
    }

    private fun message(text: String) {
        container.appScope.launch { container.snackbar.showSnackbar(text) }
    }
}
