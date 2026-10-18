package io.github.guilhermetelles.lombada.ui.notify

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.backend.BackendErrorCode
import io.github.guilhermetelles.lombada.data.backend.BackendException
import io.github.guilhermetelles.lombada.data.model.NotifyPrefs
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Estado das preferências de notificação.
 *
 * @property prefs Preferências, ou null enquanto carregam (ou se falhou).
 * @property failed Se a leitura falhou; a tela oferece tentar de novo.
 * @property sendingTest Se a notificação de teste está indo.
 */
data class NotifyPrefsState(
    val prefs: NotifyPrefs? = null,
    val failed: Boolean = false,
    val sendingTest: Boolean = false
)

// Junta toques seguidos num pedido só.
private const val SAVE_DELAY_MS = 600L

/**
 * Preferências de notificação, guardadas no backend (`GET`/`PUT /api/me/notify`). Cada mudança vale
 * na tela na hora e vai ao backend logo depois; se falhar, volta ao que está no servidor.
 *
 * @param container Dependências do app.
 */
class NotifyPrefsViewModel(private val container: AppContainer) : ViewModel() {
    private val _state = MutableStateFlow(NotifyPrefsState())

    /** Estado da tela. */
    val state: StateFlow<NotifyPrefsState> = _state.asStateFlow()

    private var saveJob: Job? = null

    init {
        load()
    }

    /** Lê as preferências do backend. */
    fun load() {
        _state.update { it.copy(failed = false) }
        viewModelScope.launch {
            try {
                val prefs = container.backend.getNotifyPrefs()
                _state.update { it.copy(prefs = prefs, failed = false) }
            } catch (_: BackendException) {
                _state.update { it.copy(failed = it.prefs == null) }
            }
        }
    }

    /**
     * Muda as preferências e grava logo depois.
     *
     * @param change O que mudar.
     */
    fun update(change: (NotifyPrefs) -> NotifyPrefs) {
        val current = _state.value.prefs ?: return
        val next = change(current)
        if (next == current) return
        _state.update { it.copy(prefs = next) }
        saveJob?.cancel()
        // No escopo do app: sair da tela logo depois do toque não perde a mudança.
        saveJob =
            container.appScope.launch {
                delay(SAVE_DELAY_MS)
                try {
                    val saved = container.backend.putNotifyPrefs(next)
                    // Só aplica se nada mudou enquanto o pedido ia.
                    _state.update { if (it.prefs == next) it.copy(prefs = saved) else it }
                } catch (error: BackendException) {
                    message(
                        if (error.code == BackendErrorCode.NETWORK) {
                            "Sem conexão: a mudança não foi salva."
                        } else {
                            "Não deu para salvar a mudança."
                        }
                    )
                    load()
                }
            }
    }

    /** Manda uma notificação de teste para os aparelhos da pessoa (`POST /api/me/notify-test`). */
    fun sendTest() {
        if (_state.value.sendingTest) return
        _state.update { it.copy(sendingTest = true) }
        viewModelScope.launch {
            val text =
                try {
                    when (val sent = container.backend.notifyTest()) {
                        0 -> "Nenhum aparelho registrado ainda. Abra o app de novo com internet e tente outra vez."
                        1 -> "Notificação enviada para 1 aparelho."
                        else -> "Notificação enviada para $sent aparelhos."
                    }
                } catch (error: BackendException) {
                    if (error.code ==
                        BackendErrorCode.NETWORK
                    ) {
                        "Sem conexão com o servidor."
                    } else {
                        "Não deu para enviar o teste."
                    }
                }
            _state.update { it.copy(sendingTest = false) }
            message(text)
        }
    }

    private fun message(text: String) {
        container.appScope.launch { container.snackbar.showSnackbar(text) }
    }
}
