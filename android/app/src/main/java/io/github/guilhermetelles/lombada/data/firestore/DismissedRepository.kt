package io.github.guilhermetelles.lombada.data.firestore

import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.snapshots
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Sugestões recusadas ("Não quero") em `lists/{listId}/dismissed/{tmdbId}`. As gravações não
 * esperam o servidor, como nas entradas; só uma recusa das regras chega a [onError].
 *
 * @param db Instância do Firestore.
 * @param onError Recebe as gravações recusadas, para avisar a pessoa.
 */
class DismissedRepository(private val db: FirebaseFirestore, private val onError: (Exception) -> Unit) {
    private fun dismissed(listId: String) = db.collection("lists").document(listId).collection("dismissed")

    /**
     * Acompanha os filmes recusados.
     *
     * @param listId Lista.
     * @return Fluxo com os ids TMDb recusados.
     */
    fun observe(listId: String): Flow<Set<Int>> = dismissed(listId)
        .snapshots()
        .map { snapshot -> snapshot.documents.mapNotNull { it.id.toIntOrNull() }.toSet() }
        .endOnPermissionDenied()

    /**
     * Recusa uma sugestão, com `by` e `at` do jeito que as regras exigem.
     *
     * @param listId Lista.
     * @param tmdbId Filme.
     * @param uid Pessoa logada.
     */
    fun dismiss(listId: String, tmdbId: Int, uid: String) {
        dismissed(listId)
            .document(tmdbId.toString())
            .set(mapOf("by" to uid, "at" to FieldValue.serverTimestamp()))
            .addOnFailureListener(onError)
    }

    /**
     * Desfaz a recusa.
     *
     * @param listId Lista.
     * @param tmdbId Filme.
     */
    fun undo(listId: String, tmdbId: Int) {
        dismissed(listId).document(tmdbId.toString()).delete().addOnFailureListener(onError)
    }
}
