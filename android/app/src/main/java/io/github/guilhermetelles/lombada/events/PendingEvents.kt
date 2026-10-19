package io.github.guilhermetelles.lombada.events

import kotlinx.serialization.Serializable

/**
 * Tipo de evento da lista, no formato de `POST /api/lists/{id}/events`.
 *
 * @property wire Valor enviado ao backend.
 */
enum class ListEventType(val wire: String) {
    /** Entrada nova. */
    Added("added"),

    /** Entrada mudou de posição (arrastar, mover pelo leitor de tela ou duelo). */
    Moved("moved"),

    /** Comentário novo ou editado. */
    Commented("commented"),

    /** Entrada retirada da lista. */
    Removed("removed")
}

/**
 * Evento esperando o envio.
 *
 * @property type Valor de [ListEventType.wire].
 * @property entryId Entrada.
 * @property tmdbId Filme, só em [ListEventType.Removed] (a entrada já não existe para o backend ler).
 */
@Serializable
data class PendingEvent(val type: String, val entryId: String, val tmdbId: Int? = null)

/** Regras da fila local de eventos de uma lista, sem Android. */
object PendingEvents {
    /** Máximo de eventos por pedido, como o backend aceita. */
    const val BATCH_SIZE = 50

    // Teto da fila local: sem rede por muito tempo, os mais antigos saem primeiro.
    private const val MAX_PENDING = 200

    /**
     * Acrescenta um evento. O mesmo tipo para a mesma entrada vale uma vez só no lote: mover três
     * vezes seguidas é um "moved".
     *
     * @param pending Fila atual.
     * @param event Evento novo.
     * @return A fila com o evento.
     */
    fun add(pending: List<PendingEvent>, event: PendingEvent): List<PendingEvent> =
        if (event in pending) pending else (pending + event).takeLast(MAX_PENDING)

    /**
     * Tira os eventos de uma entrada, como quando a adição é desfeita.
     *
     * @param pending Fila atual.
     * @param entryId Entrada.
     * @return A fila sem os eventos dela.
     */
    fun withoutEntry(pending: List<PendingEvent>, entryId: String): List<PendingEvent> =
        pending.filterNot { it.entryId == entryId }

    /**
     * Se a adição de uma entrada ainda está na fila, ou seja, se o backend ainda não soube dela.
     *
     * @param pending Fila atual.
     * @param entryId Entrada.
     * @return true quando o evento `added` dela ainda não foi enviado.
     */
    fun hasPendingAdd(pending: List<PendingEvent>, entryId: String): Boolean =
        pending.any { it.entryId == entryId && it.type == ListEventType.Added.wire }

    /**
     * Próximo lote a enviar.
     *
     * @param pending Fila atual.
     * @return Até [BATCH_SIZE] eventos, os mais antigos primeiro.
     */
    fun nextBatch(pending: List<PendingEvent>): List<PendingEvent> = pending.take(BATCH_SIZE)

    /**
     * Tira da fila o que já foi enviado, mantendo o que chegou durante o envio.
     *
     * @param pending Fila atual.
     * @param sent Lote enviado.
     * @return A fila sem o lote.
     */
    fun removeSent(pending: List<PendingEvent>, sent: List<PendingEvent>): List<PendingEvent> {
        val done = sent.toSet()
        return pending.filterNot { it in done }
    }
}
