package io.github.guilhermetelles.lombada.data.firestore

import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.snapshots
import io.github.guilhermetelles.lombada.data.model.Credit
import io.github.guilhermetelles.lombada.data.model.Person
import java.time.LocalDate
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Fichas `people/{id}`, que só o backend escreve.
 *
 * @param db Instância do Firestore.
 */
class PersonRepository(private val db: FirebaseFirestore) {
    /**
     * Acompanha a ficha de uma pessoa.
     *
     * @param personId Pessoa.
     * @return Fluxo com a ficha, ou null enquanto ela nunca foi buscada.
     */
    fun observe(personId: Int): Flow<Person?> = db
        .collection("people")
        .document(personId.toString())
        .snapshots()
        .map { it.toPerson() }
        .endOnPermissionDenied()

    private fun DocumentSnapshot.toPerson(): Person? {
        if (!exists()) return null
        return Person(
            id = id.toIntOrNull() ?: return null,
            name = getString("name") ?: return null,
            birthday = getString("birthday")?.let { runCatching { LocalDate.parse(it) }.getOrNull() },
            deathday = getString("deathday")?.let { runCatching { LocalDate.parse(it) }.getOrNull() },
            placeOfBirth = getString("placeOfBirth"),
            biography = getString("biography")?.takeIf { it.isNotBlank() },
            biographyInEnglish = getString("bioLang") == "en",
            profilePath = getString("profilePath"),
            imdbId = getString("imdbId"),
            directedCount = getLong("directedCount")?.toInt() ?: 0,
            directed = credits("directed"),
            actedCount = getLong("actedCount")?.toInt() ?: 0,
            acted = credits("acted"),
            fetchedAt = getTimestamp("fetchedAt")?.toDate()?.toInstant()
        )
    }

    private fun DocumentSnapshot.credits(field: String): List<Credit> =
        (get(field) as? List<*>).orEmpty().filterIsInstance<Map<*, *>>().mapNotNull { item ->
            Credit(
                tmdbId = (item["tmdbId"] as? Number)?.toInt() ?: return@mapNotNull null,
                title = item["title"] as? String ?: return@mapNotNull null,
                year = (item["year"] as? Number)?.toInt(),
                character = item["character"] as? String
            )
        }
}
