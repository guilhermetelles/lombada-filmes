package io.github.guilhermetelles.lombada.data.firestore

import com.google.firebase.Timestamp
import com.google.firebase.firestore.AggregateSource
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.snapshots
import io.github.guilhermetelles.lombada.data.model.FeedItem
import java.time.Instant
import java.util.Date
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await

/**
 * Atividade da lista em `lists/{listId}/feed/{feedId}`, escrita só pelo backend.
 *
 * @param db Instância do Firestore.
 */
class FeedRepository(private val db: FirebaseFirestore) {
    private fun feed(listId: String) = db.collection("lists").document(listId).collection("feed")

    /**
     * Acompanha os itens mais recentes.
     *
     * @param listId Lista.
     * @param since Só os itens criados depois deste instante; null não corta.
     * @param limit Quantos itens, no máximo.
     * @return Fluxo com os itens, do mais novo para o mais antigo.
     */
    fun observe(listId: String, since: Instant? = null, limit: Long = 100): Flow<List<FeedItem>> {
        val ordered = feed(listId).orderBy("createdAt", Query.Direction.DESCENDING)
        val query = if (since == null) ordered else ordered.whereGreaterThan("createdAt", Timestamp(Date.from(since)))
        return query.limit(limit).observeItems()
    }

    private fun Query.observeItems(): Flow<List<FeedItem>> = snapshots()
        .map { snapshot -> snapshot.documents.mapNotNull { it.toFeedItem() } }
        .endOnPermissionDenied()

    /**
     * Conta os itens novos para o contador do sino, com a agregação `count()`.
     *
     * @param listId Lista.
     * @param since `users/{uid}.feedSeenAt.{listId}`; null conta tudo.
     * @return Quantidade de itens depois de [since].
     */
    suspend fun countSince(listId: String, since: Instant?): Long {
        val query =
            if (since == null) {
                feed(listId)
            } else {
                feed(listId).whereGreaterThan("createdAt", Timestamp(Date.from(since)))
            }
        return query.count().get(AggregateSource.SERVER).await().count
    }

    private fun DocumentSnapshot.toFeedItem(): FeedItem? = FeedItem(
        id = id,
        type = getString("type") ?: return null,
        kind = getString("kind").orEmpty(),
        createdAt = getTimestamp("createdAt")?.toDate()?.toInstant(),
        actorUid = getString("actorUid"),
        title = getString("title") ?: return null,
        body = getString("body"),
        quote = getString("quote"),
        route = (get("route") as? Map<*, *>)?.toRouteRef()
    )
}
