package io.github.guilhermetelles.lombada.data.firestore

import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.snapshots
import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.MovieSnapshot
import io.github.guilhermetelles.lombada.data.model.PersonRef
import java.time.LocalDate
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Entradas de uma lista. As gravações não esperam o servidor: o SDK aplica na hora no cache,
 * sincroniza quando houver rede, e só uma recusa das regras chega a [onError].
 *
 * @param db Instância do Firestore.
 * @param onError Recebe as gravações recusadas, para avisar a pessoa.
 */
class EntryRepository(private val db: FirebaseFirestore, private val onError: (Exception) -> Unit) {
    private fun entries(listId: String) = db.collection("lists").document(listId).collection("entries")

    /**
     * Acompanha as entradas na ordem do ranking.
     *
     * @param listId Lista.
     * @return Fluxo com as entradas ordenadas por `rankKey`.
     */
    fun observeRanking(listId: String): Flow<List<Entry>> = entries(listId)
        .orderBy("rankKey")
        .snapshots()
        .map { snapshot -> snapshot.documents.mapNotNull { it.toEntry() } }
        .endOnPermissionDenied()

    /**
     * Move a entrada, gravando só a chave nova.
     *
     * @param listId Lista.
     * @param entryId Entrada.
     * @param rankKey Chave entre as vizinhas da nova posição.
     * @param uid Quem moveu.
     */
    fun move(listId: String, entryId: String, rankKey: String, uid: String) {
        entries(listId)
            .document(entryId)
            .update(mapOf("rankKey" to rankKey, "updatedBy" to uid, "updatedAt" to FieldValue.serverTimestamp()))
            .addOnFailureListener(onError)
    }

    /**
     * Edita data e comentário.
     *
     * @param listId Lista.
     * @param entryId Entrada.
     * @param watchedOn Data, ou null.
     * @param comment Comentário, até 5.000 caracteres.
     * @param uid Quem editou.
     */
    fun edit(listId: String, entryId: String, watchedOn: LocalDate?, comment: String, uid: String) {
        entries(listId)
            .document(entryId)
            .update(
                mapOf(
                    "watchedOn" to watchedOn?.toString(),
                    "comment" to comment,
                    "updatedBy" to uid,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).addOnFailureListener(onError)
    }

    /**
     * Cria uma entrada no fim ou em qualquer posição, com a cópia resumida do filme.
     *
     * @param listId Lista.
     * @param tmdbId Filme.
     * @param rankKey Chave de ordem.
     * @param watchedOn Data, ou null.
     * @param comment Comentário.
     * @param movie Cópia resumida, copiada de `movies/{tmdbId}`.
     * @param uid Quem adicionou.
     * @return Id da entrada nova.
     */
    fun create(
        listId: String,
        tmdbId: Int,
        rankKey: String,
        watchedOn: LocalDate?,
        comment: String,
        movie: MovieSnapshot,
        uid: String
    ): String {
        val document = entries(listId).document()
        document
            .set(
                mapOf(
                    "tmdbId" to tmdbId,
                    "rankKey" to rankKey,
                    "watchedOn" to watchedOn?.toString(),
                    "comment" to comment,
                    "addedBy" to uid,
                    "updatedBy" to uid,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp(),
                    "movie" to
                        mapOf(
                            // Sempre o título em inglês, como o backend grava, nunca o trocado para a tela.
                            "title" to (movie.titleAlt ?: movie.title),
                            "year" to movie.year,
                            "posterPath" to movie.posterPath,
                            "imdb" to movie.imdb,
                            "letterboxd" to movie.letterboxd,
                            "directors" to movie.directors.take(8).map { mapOf("id" to it.id, "name" to it.name) }
                        )
                )
            ).addOnFailureListener(onError)
        return document.id
    }

    /**
     * Remove a entrada.
     *
     * @param listId Lista.
     * @param entryId Entrada.
     */
    fun remove(listId: String, entryId: String) {
        entries(listId).document(entryId).delete().addOnFailureListener(onError)
    }

    private fun DocumentSnapshot.toEntry(): Entry? {
        val movie = get("movie") as? Map<*, *> ?: return null
        return Entry(
            id = id,
            tmdbId = getLong("tmdbId")?.toInt() ?: return null,
            rankKey = getString("rankKey") ?: return null,
            watchedOn = getString("watchedOn")?.let { runCatching { LocalDate.parse(it) }.getOrNull() },
            comment = getString("comment").orEmpty(),
            addedBy = getString("addedBy").orEmpty(),
            movie = movie.toSnapshot() ?: return null
        )
    }

    private fun Map<*, *>.toSnapshot(): MovieSnapshot? = MovieSnapshot(
        title = this["title"] as? String ?: return null,
        year = (this["year"] as? Number)?.toInt(),
        posterPath = this["posterPath"] as? String,
        imdb = (this["imdb"] as? Number)?.toDouble(),
        letterboxd = (this["letterboxd"] as? Number)?.toDouble(),
        directors =
            (this["directors"] as? List<*>).orEmpty().mapNotNull { item ->
                val person = item as? Map<*, *> ?: return@mapNotNull null
                val id = (person["id"] as? Number)?.toInt() ?: return@mapNotNull null
                PersonRef(id, person["name"] as? String ?: return@mapNotNull null)
            }
    )
}
