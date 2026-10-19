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
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged

/**
 * Eventos da lista (adicionar, mover, comentar, retirar) para a Atividade e o push do outro membro:
 * guarda na fila local e agenda o envio a `POST /api/lists/{id}/events` assim que houver rede.
 *
 * @param context Contexto do app.
 */
class ListEvents(context: Context) {
    private val appContext = context.applicationContext
    private val store = PendingEventStore(appContext)

    /**
     * Registra um evento e agenda o envio (`activity-flush-{listId}`).
     *
     * @param listId Lista.
     * @param type Tipo.
     * @param entryId Entrada.
     * @param tmdbId Filme; obrigatório em [ListEventType.Removed].
     */
    fun record(listId: String, type: ListEventType, entryId: String, tmdbId: Int? = null) {
        store.update(listId) { PendingEvents.add(it, PendingEvent(type.wire, entryId, tmdbId)) }
        schedule(appContext, listId)
    }

    /**
     * Esquece os eventos de uma entrada ainda não enviados, como quando a adição é desfeita.
     *
     * @param listId Lista.
     * @param entryId Entrada.
     * @return true se a adição dela ainda estava na fila (o backend não soube da entrada).
     */
    fun forget(listId: String, entryId: String): Boolean {
        var addPending = false
        store.update(listId) { pending ->
            addPending = PendingEvents.hasPendingAdd(pending, entryId)
            PendingEvents.withoutEntry(pending, entryId)
        }
        return addPending
    }

    /**
     * Retira uma entrada: esquece os eventos dela ainda não enviados e, se a adição já tinha
     * chegado ao backend, registra a retirada para a outra pessoa saber.
     *
     * @param listId Lista.
     * @param entryId Entrada.
     * @param tmdbId Filme, que o backend precisa porque a entrada já não existe.
     */
    fun recordRemoval(listId: String, entryId: String, tmdbId: Int) {
        if (!forget(listId, entryId)) record(listId, ListEventType.Removed, entryId, tmdbId)
    }

    /**
     * Quantas mudanças da lista esperam conexão: os eventos na fila enquanto o aparelho está sem
     * internet; 0 com internet.
     *
     * @param listId Lista.
     * @return Fluxo com a contagem.
     */
    fun observeWaiting(listId: String): Flow<Int> =
        combine(store.observeCount(listId), observeOnline(appContext), PendingEvents::waiting).distinctUntilChanged()

    companion object {
        /**
         * Nome do envio único de uma lista.
         *
         * @param listId Lista.
         * @return `activity-flush-{listId}`.
         */
        fun workName(listId: String): String = "activity-flush-$listId"

        /**
         * Agenda o envio da fila de uma lista, sem espera. APPEND_OR_REPLACE encadeia um envio novo
         * depois do que estiver rodando, para nada que chegue no fim de um envio ficar parado.
         *
         * @param context Contexto.
         * @param listId Lista.
         */
        fun schedule(context: Context, listId: String) {
            val request =
                OneTimeWorkRequestBuilder<ActivityFlushWorker>()
                    .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
                    .setInputData(workDataOf(ActivityFlushWorker.KEY_LIST_ID to listId))
                    .build()
            WorkManager
                .getInstance(context)
                .enqueueUniqueWork(workName(listId), ExistingWorkPolicy.APPEND_OR_REPLACE, request)
        }
    }
}
