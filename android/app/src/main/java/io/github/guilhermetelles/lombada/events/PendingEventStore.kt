package io.github.guilhermetelles.lombada.events

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json

/**
 * Fila local de eventos por lista, em `SharedPreferences`: sobrevive ao app fechado até o
 * [ActivityFlushWorker] enviar.
 *
 * @param context Contexto do app.
 */
class PendingEventStore(context: Context) {
    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /**
     * Lê a fila de uma lista.
     *
     * @param listId Lista.
     * @return Os eventos esperando envio; vazia se não houver ou se o texto guardado estiver estragado.
     */
    fun read(listId: String): List<PendingEvent> = synchronized(LOCK) { readUnlocked(listId) }

    /**
     * Muda a fila de uma lista de forma atômica dentro do processo.
     *
     * @param listId Lista.
     * @param change Recebe a fila atual e devolve a nova.
     * @return A fila nova.
     */
    fun update(listId: String, change: (List<PendingEvent>) -> List<PendingEvent>): List<PendingEvent> =
        synchronized(LOCK) {
            val next = change(readUnlocked(listId))
            prefs.edit {
                if (next.isEmpty()) remove(listId) else putString(listId, json.encodeToString(serializer, next))
            }
            next
        }

    private fun readUnlocked(listId: String): List<PendingEvent> {
        val text = prefs.getString(listId, null) ?: return emptyList()
        return runCatching { json.decodeFromString(serializer, text) }.getOrDefault(emptyList())
    }

    private companion object {
        const val PREFS_NAME = "list-events"
        val LOCK = Any()
        val json = Json { ignoreUnknownKeys = true }
        val serializer = ListSerializer(PendingEvent.serializer())
    }
}
