package io.github.guilhermetelles.lombada.ui.status

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.backend.BackendErrorCode
import io.github.guilhermetelles.lombada.data.backend.BackendException
import io.github.guilhermetelles.lombada.data.model.AppStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Estado da leitura de `GET /api/status`. */
sealed interface StatusState {
    /** Pedido em andamento. */
    data object Loading : StatusState

    /**
     * O pedido falhou.
     *
     * @property offline Se foi falta de conexão.
     */
    data class Failed(val offline: Boolean) : StatusState

    /**
     * Status recebido.
     *
     * @property status Resposta do backend.
     */
    data class Loaded(val status: AppStatus) : StatusState
}

/**
 * Lê o status do backend uma vez ao abrir, com "Tentar de novo".
 *
 * @param container Dependências do app.
 */
class StatusViewModel(private val container: AppContainer) : ViewModel() {
    private val _state = MutableStateFlow<StatusState>(StatusState.Loading)

    /** Estado da tela. */
    val state: StateFlow<StatusState> = _state.asStateFlow()

    init {
        load()
    }

    /** Pede o status de novo. */
    fun load() {
        _state.value = StatusState.Loading
        viewModelScope.launch {
            _state.value =
                try {
                    StatusState.Loaded(container.backend.status())
                } catch (error: BackendException) {
                    StatusState.Failed(offline = error.code == BackendErrorCode.NETWORK)
                }
        }
    }
}
