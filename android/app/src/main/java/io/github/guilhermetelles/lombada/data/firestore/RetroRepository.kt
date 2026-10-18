package io.github.guilhermetelles.lombada.data.firestore

import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldPath
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.snapshots
import io.github.guilhermetelles.lombada.data.model.Retro
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Retrospectivas mensais em `lists/{listId}/retros/{mês}`, escritas só pelo backend.
 *
 * @param db Instância do Firestore.
 */
class RetroRepository(private val db: FirebaseFirestore) {
    private fun retros(listId: String) = db.collection("lists").document(listId).collection("retros")

    /**
     * Acompanha a retrospectiva de um mês.
     *
     * @param listId Lista.
     * @param month Mês `AAAA-MM`.
     * @return Fluxo com a retrospectiva, ou null enquanto não foi gerada.
     */
    fun observe(listId: String, month: String): Flow<Retro?> =
        retros(listId).document(month).snapshots().map { it.toRetro() }.endOnPermissionDenied()

    /**
     * Acompanha as retrospectivas mais recentes.
     *
     * @param listId Lista.
     * @param limit Quantos meses, no máximo.
     * @return Fluxo com as retrospectivas, do mês mais recente para o mais antigo.
     */
    fun observeRecent(listId: String, limit: Long = 24): Flow<List<Retro>> = retros(listId)
        .orderBy(FieldPath.documentId(), Query.Direction.DESCENDING)
        .limit(limit)
        .snapshots()
        .map { snapshot -> snapshot.documents.mapNotNull { it.toRetro() } }
        .endOnPermissionDenied()

    private fun DocumentSnapshot.toRetro(): Retro? {
        if (!exists()) return null
        return Retro(
            month = getString("month") ?: id,
            films = getLong("films")?.toInt() ?: 0,
            minutes = getLong("minutes")?.toInt() ?: 0,
            bestEntryId = getString("bestEntryId"),
            worstEntryId = getString("worstEntryId"),
            genres = (get("genres") as? List<*>).orEmpty().mapNotNull { it.toGenreCount() },
            text = getString("text")?.takeIf { it.isNotBlank() },
            generatedAt = getTimestamp("generatedAt")?.toDate()?.toInstant()
        )
    }

    // O contrato descreve pares [gênero, quantidade], mas o Firestore não guarda lista dentro de
    // lista: aceita o par e também um mapa { genre ou name, count }.
    private fun Any?.toGenreCount(): Pair<String, Int>? = when (this) {
        is List<*> -> {
            val name = getOrNull(0) as? String
            val count = (getOrNull(1) as? Number)?.toInt()
            if (name != null && count != null) name to count else null
        }

        is Map<*, *> -> {
            val name = string("genre") ?: string("name")
            val count = int("count")
            if (name != null && count != null) name to count else null
        }

        else -> null
    }
}
