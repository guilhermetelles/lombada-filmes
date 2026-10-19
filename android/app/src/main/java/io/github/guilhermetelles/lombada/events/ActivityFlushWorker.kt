package io.github.guilhermetelles.lombada.events

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.google.firebase.firestore.FirebaseFirestore
import io.github.guilhermetelles.lombada.LombadaApplication
import io.github.guilhermetelles.lombada.data.backend.BackendErrorCode
import io.github.guilhermetelles.lombada.data.backend.BackendException
import io.github.guilhermetelles.lombada.data.backend.ListEventDto
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull

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
            // O backend lê a entrada no Firestore: o evento só vai depois que as gravações locais
            // (como a entrada nova feita sem rede) chegaram ao servidor. Sem isso, o backend não
            // acha a entrada, recusa o lote e o evento se perde.
            if (!writesSynced()) return Result.retry()
            try {
                backend.sendEvents(listId, batch.map { ListEventDto(it.type, it.entryId, it.tmdbId) })
            } catch (error: BackendException) {
                if (!isRejected(error)) return Result.retry()
            }
            store.update(listId) { PendingEvents.removeSent(it, batch) }
        }
    }

    private suspend fun writesSynced(): Boolean = withTimeoutOrNull(WRITES_TIMEOUT_MS) {
        runCatching { FirebaseFirestore.getInstance().waitForPendingWrites().await() }
            .onFailure { Log.w(TAG, "Gravações pendentes não confirmadas", it) }
        true
    } ?: false

    // Recusa definitiva: mandar de novo não muda nada (entrada apagada, fora da lista, lote velho).
    private fun isRejected(error: BackendException): Boolean = error.code != BackendErrorCode.NETWORK &&
        error.status in REJECTED_STATUSES

    companion object {
        /** Lista cujos eventos o envio manda. */
        const val KEY_LIST_ID = "listId"

        private val REJECTED_STATUSES = setOf(400, 403, 404)

        private const val TAG = "ActivityFlush"

        // Rede fraca: depois disso tenta mais tarde, pelo backoff do WorkManager.
        private const val WRITES_TIMEOUT_MS = 60_000L
    }
}
