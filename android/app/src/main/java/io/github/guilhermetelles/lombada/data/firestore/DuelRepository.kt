package io.github.guilhermetelles.lombada.data.firestore

import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.snapshots
import io.github.guilhermetelles.lombada.data.model.Duel
import io.github.guilhermetelles.lombada.data.model.DuelChoice
import io.github.guilhermetelles.lombada.data.model.DuelStatus
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Duelo de revisão em `lists/{listId}/duels/{dia}`. Só o backend escreve; abrir e votar passam por
 * `BackendClient.getDuel` e `BackendClient.voteDuel`.
 *
 * @param db Instância do Firestore.
 */
class DuelRepository(private val db: FirebaseFirestore) {
    /**
     * Acompanha o duelo de um dia, para os votos dos outros membros aparecerem na hora.
     *
     * @param listId Lista.
     * @param day Dia `AAAA-MM-DD` em Brasília.
     * @return Fluxo com o duelo, ou null enquanto o backend não abriu.
     */
    fun observe(listId: String, day: String): Flow<Duel?> = db.collection("lists")
        .document(listId)
        .collection("duels")
        .document(day)
        .snapshots()
        .map { it.toDuel() }
        .endOnPermissionDenied()

    private fun DocumentSnapshot.toDuel(): Duel? {
        if (!exists()) return null
        return Duel(
            day = getString("day") ?: id,
            entryIdA = getString("entryIdA") ?: return null,
            entryIdB = getString("entryIdB") ?: return null,
            status = DuelStatus.fromWire(getString("status")) ?: return null,
            votes =
                (get("votes") as? Map<*, *>).orEmpty().entries.mapNotNull { (uid, vote) ->
                    val choice = DuelChoice.fromWire(vote as? String) ?: return@mapNotNull null
                    (uid as? String ?: return@mapNotNull null) to choice
                }.toMap()
        )
    }
}
