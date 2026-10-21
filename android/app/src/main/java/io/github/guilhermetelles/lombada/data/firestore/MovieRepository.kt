package io.github.guilhermetelles.lombada.data.firestore

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldPath
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.snapshots
import io.github.guilhermetelles.lombada.data.model.Bechdel
import io.github.guilhermetelles.lombada.data.model.CastMember
import io.github.guilhermetelles.lombada.data.model.Director
import io.github.guilhermetelles.lombada.data.model.Movie
import io.github.guilhermetelles.lombada.data.model.MovieCollection
import io.github.guilhermetelles.lombada.data.model.MovieRecInfo
import io.github.guilhermetelles.lombada.data.model.MovieTrailer
import io.github.guilhermetelles.lombada.data.model.ProvidersBR
import io.github.guilhermetelles.lombada.data.model.Rating
import java.time.LocalDate
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map

/**
 * Catálogo `movies/{tmdbId}`, que só o backend escreve e qualquer pessoa logada lê.
 *
 * @param db Instância do Firestore.
 */
class MovieRepository(private val db: FirebaseFirestore) {
    private val movies = db.collection("movies")

    /**
     * Acompanha um filme.
     *
     * @param tmdbId Filme.
     * @return Fluxo com o filme, ou null enquanto ele não está no banco.
     */
    fun observe(tmdbId: Int): Flow<Movie?> =
        movies.document(tmdbId.toString()).snapshots().map { it.toMovie() }.endOnPermissionDenied()

    /**
     * Acompanha vários filmes, em consultas de até 30 ids (limite do `whereIn`).
     *
     * @param tmdbIds Filmes.
     * @return Fluxo com os filmes encontrados, por id.
     */
    fun observeMany(tmdbIds: Collection<Int>): Flow<Map<Int, Movie>> {
        val chunks = tmdbIds.distinct().sorted().chunked(30)
        if (chunks.isEmpty()) return flowOf(emptyMap())
        val flows =
            chunks.map { chunk ->
                movies
                    .whereIn(FieldPath.documentId(), chunk.map(Int::toString))
                    .snapshots()
                    .map { snapshot -> snapshot.documents.mapNotNull { it.toMovie() } }
                    .endOnPermissionDenied()
            }
        return combine(flows) { parts -> parts.flatMap { it }.associateBy { it.tmdbId } }
    }

    private fun DocumentSnapshot.toMovie(): Movie? {
        if (!exists()) return null
        val ratings = get("ratings") as? Map<*, *>
        val ids = get("ids") as? Map<*, *>
        val synopsis = get("synopsis") as? Map<*, *>
        val rawDirectors = (get("directors") as? List<*>).orEmpty().filterIsInstance<Map<*, *>>()
        return Movie(
            tmdbId = id.toIntOrNull() ?: return null,
            title = getString("title") ?: return null,
            year = getLong("year")?.toInt(),
            directors =
                rawDirectors.mapNotNull { item ->
                    Director(
                        item.int("id") ?: return@mapNotNull null,
                        item["name"] as? String ?: return@mapNotNull null,
                        item["profilePath"] as? String
                    )
                },
            cast =
                (get("cast") as? List<*>).orEmpty().filterIsInstance<Map<*, *>>().mapNotNull { item ->
                    CastMember(
                        id = item.int("id") ?: return@mapNotNull null,
                        name = item["name"] as? String ?: return@mapNotNull null,
                        character = item["character"] as? String,
                        profilePath = item["profilePath"] as? String
                    )
                },
            runtime = getLong("runtime")?.toInt(),
            genres = (get("genres") as? List<*>).orEmpty().filterIsInstance<String>(),
            synopsisPt = synopsis?.get("pt") as? String,
            synopsisEn = synopsis?.get("en") as? String,
            posterPath = getString("posterPath"),
            imdbId = ids?.get("imdb") as? String,
            letterboxdUrl = ids?.get("letterboxd") as? String,
            letterboxd = ratings.rating("letterboxd"),
            imdb = ratings.rating("imdb"),
            rottenTomatoes = ratings.rating("rottenTomatoes"),
            metacritic = ratings.rating("metacritic"),
            tmdbFetchedAt = getTimestamp("tmdbFetchedAt")?.toDate()?.toInstant(),
            missingDirectorPhotos = rawDirectors.any { !it.containsKey("profilePath") },
            bechdel = (get("bechdel") as? Map<*, *>)?.toBechdel(),
            titlePt = getString("titlePt"),
            tagline = getString("tagline")?.takeIf { it.isNotBlank() },
            budget = (get("budget") as? Number)?.toLong()?.takeIf { it > 0 },
            revenue = (get("revenue") as? Number)?.toLong()?.takeIf { it > 0 },
            boxOfficeUS = (get("boxOfficeUS") as? Number)?.toLong()?.takeIf { it > 0 },
            certBR = getString("certBR")?.takeIf { it.isNotBlank() },
            collection =
                (get("collection") as? Map<*, *>)?.let { item ->
                    MovieCollection(item.int("id") ?: return@let null, item.string("name") ?: return@let null)
                },
            keywords = (get("keywords") as? List<*>).orEmpty().filterIsInstance<String>(),
            recs = (get("recs") as? List<*>).orEmpty().filterIsInstance<Number>().map { it.toInt() },
            recsInfo =
                (get("recsInfo") as? List<*>).orEmpty().filterIsInstance<Map<*, *>>().mapNotNull { item ->
                    MovieRecInfo(
                        tmdbId = item.int("tmdbId") ?: return@mapNotNull null,
                        title = item.string("title") ?: return@mapNotNull null,
                        year = item.int("year"),
                        posterPath = item.string("posterPath"),
                        titleEn = item.string("titleEn")
                    )
                },
            providersBR =
                (get("providersBR") as? Map<*, *>)?.let { item ->
                    ProvidersBR(item.strings("flatrate"), item.strings("previous"), item["fetchedAt"].asInstant())
                },
            backdropPath = getString("backdropPath")?.takeIf { it.isNotBlank() },
            trailer = (get("trailer") as? Map<*, *>)?.toTrailer(),
            awards = (get("awards") as? Map<*, *>)?.toAwards(),
            popularity = (get("popularity") as? Number)?.toDouble(),
            vote = (get("vote") as? Number)?.toDouble(),
            votes = (get("votes") as? Number)?.toInt(),
            extraFetchedAt = getTimestamp("extraFetchedAt")?.toDate()?.toInstant()
        )
    }

    // Sem id do vídeo vira null; data fora do formato AAAA-MM-DD fica sem data.
    private fun Map<*, *>.toTrailer(): MovieTrailer? {
        val key = string("key")?.takeIf { it.isNotBlank() } ?: return null
        val published = string("published")?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
        return MovieTrailer(key, string("name").orEmpty(), string("lang"), published)
    }

    // Fora do formato vira null: id que não é número, ou filme no site sem critérios de 0 a 3.
    private fun Map<*, *>.toBechdel(): Bechdel? {
        val siteId = this["siteId"]
        if (siteId != null && siteId !is Number) return null
        val rating = (this["rating"] as? Number)?.toInt()?.takeIf { it in 0..Bechdel.CRITERIA }
        if (siteId != null && rating == null) return null
        return Bechdel(
            siteId = (siteId as? Number)?.toInt(),
            url = this["url"] as? String,
            rating = rating,
            dubious = this["dubious"] as? Boolean ?: false,
            disputes = (this["disputes"] as? Number)?.toInt()?.coerceAtLeast(0) ?: 0,
            fetchedAt = (this["fetchedAt"] as? Timestamp)?.toDate()?.toInstant()
        )
    }

    private fun Map<*, *>?.rating(key: String): Rating? {
        val rating = this?.get(key) as? Map<*, *> ?: return null
        return Rating(
            value = (rating["value"] as? Number)?.toDouble(),
            fetchedAt = (rating["fetchedAt"] as? Timestamp)?.toDate()?.toInstant(),
            url = rating["url"] as? String
        )
    }
}
