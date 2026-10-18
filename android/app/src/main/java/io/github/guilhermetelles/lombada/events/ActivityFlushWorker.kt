package io.github.guilhermetelles.lombada.events

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import io.github.guilhermetelles.lombada.LombadaApplication
import io.github.guilhermetelles.lombada.data.backend.BackendErrorCode
import io.github.guilhermetelles.lombada.data.backend.BackendException
import io.github.guilhermetelles.lombada.data.backend.ListEventDto

/**
 * Envia a fila local de eventos de uma lista, em lotes de até 50. Falha de rede ou do servidor
 * tenta de novo mais tarde (o backoff do WorkManager); um lote que o servidor recusa por ser
 * inválido (400, 403, 404) sai da fila, para não travar os seguintes.
 *
 * @param context Contexto do app.
 * @param params Parâmetros do WorkManager, com [KEY_LIST_ID].
 */
class ActivityFlushWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val listId = inputData.getString(KEY_LIST_ID) ?: return Result.failure()
        val store = PendingEventStore(applicationContext)
        val backend = (applicationContext as LombadaApplication).container.backend
        while (true) {
            val batch = PendingEvents.nextBatch(store.read(listId))
            if (batch.isEmpty()) return Result.success()
            try {
                backend.sendEvents(listId, batch.map { ListEventDto(it.type, it.entryId) })
            } catch (error: BackendException) {
                if (!isRejected(error)) return Result.retry()
            }
            store.update(listId) { PendingEvents.removeSent(it, batch) }
        }
    }

    // Recusa definitiva: mandar de novo não muda nada (entrada apagada, fora da lista, lote velho).
    private fun isRejected(error: BackendException): Boolean = error.code != BackendErrorCode.NETWORK &&
        error.status in REJECTED_STATUSES

    companion object {
        /** Lista cujos eventos o envio manda. */
        const val KEY_LIST_ID = "listId"

        private val REJECTED_STATUSES = setOf(400, 403, 404)
    }
}
