package io.github.guilhermetelles.lombada.data.firestore

import com.google.firebase.firestore.FieldPath
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.snapshots
import io.github.guilhermetelles.lombada.data.model.SourceUsage
import io.github.guilhermetelles.lombada.data.model.UsageDay
import java.time.LocalDate
import java.time.ZoneId
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/** Fuso em que o backend agrupa o consumo por dia. */
private val SAO_PAULO: ZoneId = ZoneId.of("America/Sao_Paulo")

/**
 * Consumo das APIs por dia, em `usage/`.
 *
 * @param db Instância do Firestore.
 */
class UsageRepository(private val db: FirebaseFirestore) {
    /**
     * Acompanha os últimos dias de consumo.
     *
     * @param days Quantos dias.
     * @return Dias do mais antigo para o mais recente.
     */
    fun observeRecent(days: Long = 30): Flow<List<UsageDay>> = db
        .collection("usage")
        // Faixa de ids (yyyy-mm-dd) em ordem crescente, que o Firestore atende sem índice composto.
        .whereGreaterThanOrEqualTo(FieldPath.documentId(), LocalDate.now(SAO_PAULO).minusDays(days - 1).toString())
        .snapshots()
        .map { snapshot ->
            snapshot.documents
                .mapNotNull { document ->
                    val day = runCatching { LocalDate.parse(document.id) }.getOrNull() ?: return@mapNotNull null
                    val sources =
                        document.data.orEmpty().mapNotNull { (name, value) ->
                            val fields = value as? Map<*, *> ?: return@mapNotNull null
                            name to
                                SourceUsage(
                                    calls = (fields["calls"] as? Number)?.toInt() ?: 0,
                                    errors = (fields["errors"] as? Number)?.toInt() ?: 0,
                                    cacheHits = (fields["cacheHits"] as? Number)?.toInt() ?: 0,
                                    dailyLimit = (fields["dailyLimit"] as? Number)?.toInt()
                                )
                        }.toMap()
                    UsageDay(day, sources)
                }.sortedBy { it.day }
        }.endOnPermissionDenied()
}
