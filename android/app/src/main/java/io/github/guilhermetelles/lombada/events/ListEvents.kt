package io.github.guilhermetelles.lombada.events

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import java.util.concurrent.TimeUnit

/**
 * Eventos da lista (adicionar, mover, comentar) para a Atividade e o push do outro membro: guarda
 * na fila local e agenda um envio único por lista, que junta tudo o que acontecer nos próximos
 * minutos num pedido só a `POST /api/lists/{id}/events`.
 *
 * @param context Contexto do app.
 */
class ListEvents(context: Context) {
    private val appContext = context.applicationContext
    private val store = PendingEventStore(appContext)

    /**
     * Registra um evento e agenda o envio (`activity-flush-{listId}`, KEEP: o agendado não muda).
     *
     * @param listId Lista.
     * @param type Tipo.
     * @param entryId Entrada.
     */
    fun record(listId: String, type: ListEventType, entryId: String) {
        store.update(listId) { PendingEvents.add(it, PendingEvent(type.wire, entryId)) }
        schedule(appContext, listId)
    }

    /**
     * Esquece os eventos de uma entrada ainda não enviados, como quando a adição é desfeita.
     *
     * @param listId Lista.
     * @param entryId Entrada.
     */
    fun forget(listId: String, entryId: String) {
        store.update(listId) { PendingEvents.withoutEntry(it, entryId) }
    }

    companion object {
        /** Espera antes de enviar, para juntar os eventos próximos num lote. */
        const val FLUSH_DELAY_MINUTES = 10L

        /**
         * Nome do envio único de uma lista.
         *
         * @param listId Lista.
         * @return `activity-flush-{listId}`.
         */
        fun workName(listId: String): String = "activity-flush-$listId"

        /**
         * Agenda o envio da fila de uma lista, se ainda não houver um agendado.
         *
         * @param context Contexto.
         * @param listId Lista.
         */
        fun schedule(context: Context, listId: String) {
            val request =
                OneTimeWorkRequestBuilder<ActivityFlushWorker>()
                    .setInitialDelay(FLUSH_DELAY_MINUTES, TimeUnit.MINUTES)
                    .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
                    .setInputData(workDataOf(ActivityFlushWorker.KEY_LIST_ID to listId))
                    .build()
            WorkManager
                .getInstance(context)
                .enqueueUniqueWork(workName(listId), ExistingWorkPolicy.KEEP, request)
        }
    }
}
