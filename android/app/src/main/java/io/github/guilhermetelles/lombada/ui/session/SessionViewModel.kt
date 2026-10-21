package io.github.guilhermetelles.lombada.ui.session

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.auth.SignInException
import io.github.guilhermetelles.lombada.data.model.MovieList
import io.github.guilhermetelles.lombada.data.model.UserProfile
import io.github.guilhermetelles.lombada.notify.DeviceRegistration
import io.github.guilhermetelles.lombada.ui.SCREEN_SHARING
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Decide o que o app mostra: entrar, escolher a primeira lista ou a lista ativa. Acompanha a
 * sessão, o perfil `users/{uid}` e as listas de que a pessoa participa.
 *
 * @param container Dependências do app.
 */
class SessionViewModel(private val container: AppContainer) : ViewModel() {
    private val _signingIn = MutableStateFlow(false)

    /** Se a janela do Google está aberta ou o login está em andamento. */
    val signingIn: StateFlow<Boolean> = _signingIn.asStateFlow()

    private val _signInError = MutableStateFlow<String?>(null)

    /** Erro do último login, para mostrar na tela de entrada. */
    val signInError: StateFlow<String?> = _signInError.asStateFlow()

    // Enquanto a tela "Lista criada" está aberta, a lista nova não abre sozinha.
    private val holdingNewList = MutableStateFlow(false)

    // Cada "Tentar de novo" na tela de erro refaz a leitura do perfil e das listas.
    private val attempt = MutableStateFlow(0)

    // Pessoa cuja lista já está aberta. Quando os fluxos recomeçam (o app volta do segundo plano),
    // a sessão dela não passa por Loading nem Failed: trocar a lista aberta pelo splash ou pelo erro
    // tiraria o MainScreen da tela e levaria junto a navegação e o estado de cada tela.
    @Volatile
    private var readyUid: String? = null

    /** Estado da sessão. */
    @OptIn(ExperimentalCoroutinesApi::class)
    val state: StateFlow<SessionState> =
        combine(container.authRepository.observeUser(), attempt) { user, _ -> user }
            .flatMapLatest { user ->
                if (user == null) {
                    flowOf(SessionState.SignedOut)
                } else {
                    flow {
                        val profile = container.users.ensure(user)
                        emit(profile)
                    }.flatMapLatest {
                        combine(
                            container.users.observe(user.uid).filterNotNull(),
                            container.lists.observeMine(user.uid),
                            holdingNewList
                        ) { profile, lists, holding -> decide(user.uid, profile, lists, holding) }
                    }.onStart { if (readyUid != user.uid) emit(SessionState.Loading) }
                        .catch { error ->
                            Log.w(TAG, "Sessão não carregada", error)
                            // Com a lista já aberta, fica nela; os fluxos recomeçam na próxima volta ao app.
                            if (readyUid != user.uid) {
                                emit(
                                    SessionState.Failed(
                                        "Não deu para carregar suas listas. Confira a internet e tente de novo."
                                    )
                                )
                            }
                        }
                }
            }.onEach { readyUid = (it as? SessionState.Ready)?.uid }
            .stateIn(viewModelScope, SCREEN_SHARING, SessionState.Loading)

    private fun decide(uid: String, profile: UserProfile, lists: List<MovieList>, holding: Boolean): SessionState {
        val ordered = orderByRecent(lists, profile.recentListIds)
        val current = ordered.firstOrNull { it.id == profile.activeListId }
        // No primeiro acesso, a lista recém-criada espera a tela do código antes de abrir.
        if (current == null && holding) return SessionState.NeedsList(uid, profile)
        val active = current ?: ordered.firstOrNull() ?: return SessionState.NeedsList(uid, profile)
        if (active.id != profile.activeListId) {
            // A lista ativa sumiu (a pessoa saiu ou a lista foi apagada): abre a mais recente.
            viewModelScope.launch { runCatching { container.users.visit(uid, active.id) } }
        }
        return SessionState.Ready(uid, profile, active, ordered)
    }

    /** Tenta de novo carregar o perfil e as listas, depois de uma falha. */
    fun retry() {
        attempt.value += 1
    }

    /**
     * Abre a janela do Google e entra.
     *
     * @param activityContext Contexto da Activity.
     */
    fun signIn(activityContext: Context) {
        if (_signingIn.value) return
        _signingIn.value = true
        _signInError.value = null
        viewModelScope.launch {
            try {
                container.authRepository.signInWithGoogle(activityContext)
            } catch (error: SignInException) {
                if (!error.cancelled) _signInError.value = "${error.message} Tente de novo."
            } finally {
                _signingIn.value = false
            }
        }
    }

    /**
     * Sai da conta. Antes, tira o token do FCM deste aparelho do backend, enquanto ainda há sessão
     * para autenticar; sem rede, segue depois de alguns segundos sem ele.
     *
     * @param context Contexto do app.
     */
    fun signOut(context: Context) {
        viewModelScope.launch {
            withTimeoutOrNull(UNREGISTER_TIMEOUT_MS) { DeviceRegistration(container.backend).unregister() }
            container.authRepository.signOut(context)
        }
    }

    /**
     * Segura a abertura automática de uma lista recém-criada, enquanto o código é mostrado.
     *
     * @param hold true ao criar; false ao tocar em "Abrir a lista".
     */
    fun holdNewList(hold: Boolean) {
        holdingNewList.value = hold
    }

    /**
     * Abre outra lista da pessoa.
     *
     * @param listId Lista escolhida.
     */
    fun openList(listId: String) {
        val uid = container.authRepository.currentUid ?: return
        viewModelScope.launch { runCatching { container.users.visit(uid, listId) } }
    }

    companion object {
        private const val TAG = "Session"

        // Quanto sair da conta espera o backend tirar o token.
        private const val UNREGISTER_TIMEOUT_MS = 5_000L

        /**
         * Ordena as listas pela ordem de visita; as nunca visitadas vão para o fim, por nome.
         *
         * @param lists Listas da pessoa.
         * @param recentIds Ordem guardada no perfil.
         * @return Listas ordenadas.
         */
        fun orderByRecent(lists: List<MovieList>, recentIds: List<String>): List<MovieList> {
            val rank = recentIds.withIndex().associate { (index, id) -> id to index }
            return lists.sortedWith(compareBy<MovieList> { rank[it.id] ?: Int.MAX_VALUE }.thenBy { it.name })
        }
    }
}
