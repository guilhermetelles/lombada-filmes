package io.github.guilhermetelles.lombada.data.firestore

import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldPath
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.snapshots
import io.github.guilhermetelles.lombada.data.model.Scores
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Placar mensal do quiz em `lists/{listId}/scores/{mês}`, escrito só pelo backend.
 *
 * @param db Instância do Firestore.
 */
class ScoresRepository(private val db: FirebaseFirestore) {
    private fun scores(listId: String) = db.collection("lists").document(listId).collection("scores")

    /**
     * Acompanha o placar de um mês.
     *
     * @param listId Lista.
     * @param month Mês `AAAA-MM` em Brasília (`BrazilDay.monthId()` para o atual).
     * @return Fluxo com o placar, ou null antes da primeira resposta do mês.
     */
    fun observe(listId: String, month: String): Flow<Scores?> =
        scores(listId).document(month).snapshots().map { it.toScores() }.endOnPermissionDenied()

    /**
     * Acompanha os placares mais recentes, para a lista de vencedores.
     *
     * @param listId Lista.
     * @param limit Quantos meses, no máximo.
     * @return Fluxo com os placares, do mês mais recente para o mais antigo.
     */
    fun observeRecent(listId: String, limit: Int = 12): Flow<List<Scores>> = scores(listId)
        // Ordem crescente pelo id, que o Firestore atende sem índice; a decrescente pede um índice
        // que não existe. São poucos documentos (um por mês): inverte e corta aqui.
        .orderBy(FieldPath.documentId())
        .snapshots()
        .map { snapshot -> snapshot.documents.mapNotNull { it.toScores() }.asReversed().take(limit) }
        .endOnPermissionDenied()

    private fun DocumentSnapshot.toScores(): Scores? {
        if (!exists()) return null
        return Scores(
            month = id,
            points =
                (get("points") as? Map<*, *>).orEmpty().entries.mapNotNull { (key, value) ->
                    val uid = key as? String ?: return@mapNotNull null
                    uid to ((value as? Number)?.toInt() ?: return@mapNotNull null)
                }.toMap(),
            winnerUids = (get("winnerUids") as? List<*>).orEmpty().filterIsInstance<String>()
        )
    }
}
