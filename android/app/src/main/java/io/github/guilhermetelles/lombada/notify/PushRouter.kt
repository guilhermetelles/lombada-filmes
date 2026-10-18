package io.github.guilhermetelles.lombada.notify

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Ponte entre o `MainActivity`, que recebe o toque no push, e o NavHost do `MainScreen`, que abre
 * a tela. Guarda um destino de cada vez, no processo: o toque seguinte substitui o anterior.
 */
object PushRouter {
    private val _pending = MutableStateFlow<PushTarget?>(null)

    /** Destino esperando ser aberto; null quando não há nenhum. */
    val pending: StateFlow<PushTarget?> = _pending.asStateFlow()

    /**
     * Guarda o destino de um toque.
     *
     * @param target Destino lido dos extras.
     */
    fun offer(target: PushTarget) {
        _pending.value = target
    }

    /**
     * Marca o destino como aberto. Só limpa se ainda for o mesmo, para não perder um toque mais novo.
     *
     * @param target Destino aberto.
     */
    fun consume(target: PushTarget) {
        _pending.compareAndSet(target, null)
    }

    /**
     * O que fazer com um destino na lista aberta agora.
     *
     * @param target Destino do push.
     * @param activeListId Lista aberta.
     * @param memberListIds Listas de que a pessoa participa; null quando ainda não se sabe.
     * @return [PushStep.SwitchList] quando o push é de outra lista da pessoa; senão [PushStep.Open].
     */
    fun stepFor(target: PushTarget, activeListId: String, memberListIds: Set<String>?): PushStep {
        val wanted = target.listId
        val isOther = wanted != null && wanted != activeListId
        // Lista de que a pessoa saiu (ou que sumiu): abre a tela na lista atual mesmo.
        return if (isOther && (memberListIds == null || wanted in memberListIds)) {
            PushStep.SwitchList(wanted)
        } else {
            PushStep.Open
        }
    }
}

/** Próximo passo para abrir um [PushTarget]. */
sealed interface PushStep {
    /**
     * Trocar para a lista do push antes de abrir a tela.
     *
     * @property listId Lista do push.
     */
    data class SwitchList(val listId: String) : PushStep

    /** Abrir a rota na lista atual. */
    data object Open : PushStep
}
