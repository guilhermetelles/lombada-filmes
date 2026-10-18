package io.github.guilhermetelles.lombada.data.firestore

import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.snapshots
import io.github.guilhermetelles.lombada.data.model.RecItem
import io.github.guilhermetelles.lombada.data.model.RecsDoc
import io.github.guilhermetelles.lombada.data.model.TasteModel
import kotlin.math.roundToInt
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Sugestões da lista em `lists/{listId}/recs/current`, escritas pela rotina `recs`.
 *
 * @param db Instância do Firestore.
 */
class RecsRepository(private val db: FirebaseFirestore) {
    /**
     * Acompanha as sugestões.
     *
     * @param listId Lista.
     * @return Fluxo com as sugestões, ou null enquanto a rotina não calculou (lista nova).
     */
    fun observe(listId: String): Flow<RecsDoc?> = db
        .collection("lists")
        .document(listId)
        .collection("recs")
        .document("current")
        .snapshots()
        .map { it.toRecs() }
        .endOnPermissionDenied()

    private fun DocumentSnapshot.toRecs(): RecsDoc? {
        if (!exists()) return null
        val model = get("model") as? Map<*, *>
        return RecsDoc(
            computedAt = getTimestamp("computedAt")?.toDate()?.toInstant(),
            modelVersion = getString("modelVersion").orEmpty(),
            model =
                model?.let { raw ->
                    TasteModel(
                        bias = raw.double("bias") ?: 0.0,
                        weights =
                            (raw["weights"] as? Map<*, *>).orEmpty().entries.mapNotNull { (key, value) ->
                                val name = key as? String ?: return@mapNotNull null
                                val weight = (value as? Number)?.toDouble() ?: return@mapNotNull null
                                name to weight
                            }.toMap()
                    )
                },
            items = recItems("items"),
            trending = recItems("trending")
        )
    }

    private fun DocumentSnapshot.recItems(field: String): List<RecItem> =
        (get(field) as? List<*>).orEmpty().filterIsInstance<Map<*, *>>().mapNotNull { item ->
            RecItem(
                tmdbId = item.int("tmdbId") ?: return@mapNotNull null,
                title = item.string("title") ?: return@mapNotNull null,
                year = item.int("year"),
                posterPath = item.string("posterPath"),
                runtime = item.int("runtime"),
                genres = item.strings("genres"),
                providers = item.strings("providers"),
                score = item.double("score")?.roundToInt() ?: 0,
                reason = item.string("reason").orEmpty(),
                reasonFrom = item.strings("reasonFrom"),
                source = item.string("source").orEmpty(),
                kind = item.string("kind").orEmpty(),
                reasonBy = item.string("reasonBy")
            )
        }
}
