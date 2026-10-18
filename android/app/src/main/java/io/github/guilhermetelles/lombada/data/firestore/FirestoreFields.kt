package io.github.guilhermetelles.lombada.data.firestore

import com.google.firebase.Timestamp
import io.github.guilhermetelles.lombada.data.model.AwardItem
import io.github.guilhermetelles.lombada.data.model.Awards
import io.github.guilhermetelles.lombada.data.model.RouteArgs
import io.github.guilhermetelles.lombada.data.model.RouteRef
import java.time.Instant

// Leitura tolerante dos campos do Firestore: tipo errado ou ausente vira null ou vazio, como no resto.

/**
 * Lê um `Timestamp` do Firestore.
 *
 * @return O instante, ou null fora do formato.
 */
internal fun Any?.asInstant(): Instant? = (this as? Timestamp)?.toDate()?.toInstant()

/**
 * Lê um número inteiro.
 *
 * @param key Campo.
 * @return O valor, ou null fora do formato.
 */
internal fun Map<*, *>.int(key: String): Int? = (this[key] as? Number)?.toInt()

/**
 * Lê um número.
 *
 * @param key Campo.
 * @return O valor, ou null fora do formato.
 */
internal fun Map<*, *>.double(key: String): Double? = (this[key] as? Number)?.toDouble()

/**
 * Lê um texto.
 *
 * @param key Campo.
 * @return O valor, ou null fora do formato.
 */
internal fun Map<*, *>.string(key: String): String? = this[key] as? String

/**
 * Lê uma lista de textos.
 *
 * @param key Campo.
 * @return Os textos; vazia fora do formato.
 */
internal fun Map<*, *>.strings(key: String): List<String> = (this[key] as? List<*>).orEmpty().filterIsInstance<String>()

/**
 * Lê uma lista de mapas.
 *
 * @param key Campo.
 * @return Os mapas; vazia fora do formato.
 */
internal fun Map<*, *>.maps(key: String): List<Map<*, *>> =
    (this[key] as? List<*>).orEmpty().filterIsInstance<Map<*, *>>()

/**
 * Lê `awards` no formato de `movies/` e `people/`; itens sem premiação ou sem tipo ficam de fora.
 *
 * @return Os prêmios.
 */
internal fun Map<*, *>.toAwards(): Awards = Awards(
    items =
        maps("items").mapNotNull { item ->
            AwardItem(
                org = item.string("org") ?: return@mapNotNull null,
                category = item.string("cat"),
                kind = item.string("kind")?.takeIf { it == AwardItem.KIND_WIN || it == AwardItem.KIND_NOMINATION }
                    ?: return@mapNotNull null,
                year = item.int("year"),
                work = item.string("for")
            )
        },
    summary = string("summary"),
    fetchedAt = this["fetchedAt"].asInstant()
)

/**
 * Lê uma `RouteRef` do feed.
 *
 * @return A rota, ou null sem `name`.
 */
internal fun Map<*, *>.toRouteRef(): RouteRef? {
    val name = string("name") ?: return null
    val args = this["args"] as? Map<*, *>
    return RouteRef(
        name = name,
        args =
            RouteArgs(
                tmdbId = args?.int("tmdbId"),
                personId = args?.int("personId"),
                day = args?.string("day"),
                month = args?.string("month"),
                entryId = args?.string("entryId"),
                entryIdB = args?.string("entryIdB")
            )
    )
}
