package io.github.guilhermetelles.lombada.ui.session

import io.github.guilhermetelles.lombada.data.model.MovieList
import io.github.guilhermetelles.lombada.data.model.UserProfile

/** Em que ponto do primeiro acesso a pessoa está. */
sealed interface SessionState {
    /** Conferindo a sessão e as listas. */
    data object Loading : SessionState

    /** Ninguém logado: tela "Entrar com Google". */
    data object SignedOut : SessionState

    /** Logada, mas ainda sem lista: "Como vocês querem começar?". */
    data class NeedsList(val uid: String, val profile: UserProfile) : SessionState

    /**
     * Com uma lista aberta.
     *
     * @property uid Pessoa logada.
     * @property profile Perfil, com as listas recentes.
     * @property list Lista ativa.
     * @property lists Todas as listas da pessoa, na ordem das recentes.
     */
    data class Ready(val uid: String, val profile: UserProfile, val list: MovieList, val lists: List<MovieList>) :
        SessionState

    /** Falha ao preparar a sessão, com a mensagem para a pessoa. */
    data class Failed(val message: String) : SessionState
}
