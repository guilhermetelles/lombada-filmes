package io.github.guilhermetelles.lombada.data.firestore

import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.snapshots
import io.github.guilhermetelles.lombada.data.model.QueueItem
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Fila "Quero ver" em `lists/{listId}/queue/{tmdbId}`. Os membros só leem; pôr e tirar da fila
 * passam pelo backend (`BackendClient.addToQueue` e `removeFromQueue`).
 *
 * @param db Instância do Firestore.
 */
class QueueRepository(private val db: FirebaseFirestore) {
    private fun queue(listId: String) = db.collection("lists").document(listId).collection("queue")

    /**
     * Acompanha a fila, do filme posto por último para o primeiro.
     *
     * @param listId Lista.
     * @return Fluxo com os itens da fila.
     */
    fun observe(listId: String): Flow<List<QueueItem>> = queue(listId)
        .orderBy("createdAt", Query.Direction.DESCENDING)
        .snapshots()
        .map { snapshot -> snapshot.documents.mapNotNull { it.toQueueItem() } }
        .endOnPermissionDenied()

    private fun DocumentSnapshot.toQueueItem(): QueueItem? = QueueItem(
        tmdbId = getLong("tmdbId")?.toInt() ?: id.toIntOrNull() ?: return null,
        addedBy = getString("addedBy").orEmpty(),
        createdAt = getTimestamp("createdAt")?.toDate()?.toInstant()
    )
}
