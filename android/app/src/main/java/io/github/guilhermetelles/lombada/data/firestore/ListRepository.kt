package io.github.guilhermetelles.lombada.data.firestore

import com.google.firebase.firestore.AggregateSource
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.snapshots
import io.github.guilhermetelles.lombada.data.model.MemberProfile
import io.github.guilhermetelles.lombada.data.model.MovieList
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await

/**
 * Listas em `lists/{listId}`. O app só lê e edita nome e descrição; criar, entrar, sair e apagar
 * passam pelo backend.
 *
 * @param db Instância do Firestore.
 */
class ListRepository(private val db: FirebaseFirestore) {
    private val lists = db.collection("lists")

    /**
     * Acompanha as listas de que a pessoa participa.
     *
     * @param uid Pessoa logada.
     * @return Fluxo com as listas, sem ordem definida (o app ordena por `recentListIds`).
     */
    fun observeMine(uid: String): Flow<List<MovieList>> = lists
        .whereArrayContains("memberUids", uid)
        .snapshots()
        // Um resultado vazio vindo só do cache não quer dizer "sem listas": espera o servidor.
        .filter { !(it.isEmpty && it.metadata.isFromCache) }
        .map { snapshot -> snapshot.documents.mapNotNull { it.toList() } }
        .endOnPermissionDenied()

    /**
     * Lê as listas de que a pessoa participa uma vez, direto do servidor quando há rede.
     *
     * @param uid Pessoa logada.
     * @return As listas.
     */
    suspend fun fetchMine(uid: String): List<MovieList> = lists
        .whereArrayContains("memberUids", uid)
        .get()
        .await()
        .documents
        .mapNotNull { it.toList() }

    /**
     * Acompanha uma lista.
     *
     * @param listId Lista.
     * @return Fluxo com a lista, ou null quando ela some ou a pessoa sai.
     */
    fun observe(listId: String): Flow<MovieList?> =
        lists.document(listId).snapshots().map { it.toList() }.endOnPermissionDenied()

    /**
     * Edita nome e descrição.
     *
     * @param listId Lista.
     * @param name Nome novo, 1 a 80 caracteres.
     * @param description Descrição nova, até 280.
     */
    suspend fun updateDetails(listId: String, name: String, description: String) {
        lists
            .document(listId)
            .update(
                mapOf("name" to name, "description" to description, "updatedAt" to FieldValue.serverTimestamp())
            ).await()
    }

    /**
     * Conta os filmes da lista com a agregação `count()`.
     *
     * @param listId Lista.
     * @return Quantidade de entradas.
     */
    suspend fun countEntries(listId: String): Long = lists
        .document(listId)
        .collection("entries")
        .count()
        .get(AggregateSource.SERVER)
        .await()
        .count

    private fun DocumentSnapshot.toList(): MovieList? {
        if (!exists()) return null
        @Suppress("UNCHECKED_CAST")
        return MovieList(
            id = id,
            name = getString("name").orEmpty(),
            description = getString("description").orEmpty(),
            ownerUid = getString("ownerUid").orEmpty(),
            memberUids = (get("memberUids") as? List<String>).orEmpty(),
            memberProfiles = (get("memberProfiles") as? Map<*, *>).orEmpty().toMemberProfiles()
        )
    }

    // Membro sem nome fica de fora; foto só em https, como no resto do app.
    private fun Map<*, *>.toMemberProfiles(): Map<String, MemberProfile> = mapNotNull { (key, value) ->
        val uid = key as? String ?: return@mapNotNull null
        val fields = value as? Map<*, *> ?: return@mapNotNull null
        val name = fields.string("name")?.trim()?.takeIf { it.isNotEmpty() } ?: return@mapNotNull null
        uid to MemberProfile(name = name, photoUrl = fields.string("photoUrl")?.takeIf { it.startsWith("https://") })
    }.toMap()
}
