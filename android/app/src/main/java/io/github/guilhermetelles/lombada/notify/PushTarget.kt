package io.github.guilhermetelles.lombada.notify

import io.github.guilhermetelles.lombada.data.model.RouteRef
import kotlinx.serialization.json.Json

/**
 * Para onde um push leva, lido dos dados da mensagem (contrato §4): `listId`, `route` (uma
 * [RouteRef] em JSON) e `feedId`. Os mesmos nomes chegam como extras do `MainActivity`, tanto no
 * aviso montado pelo app quanto no que o sistema mostra com o app fechado.
 *
 * @property listId Lista do aviso; null fica na lista ativa.
 * @property route Tela a abrir; null só traz o app para a frente (na lista).
 * @property feedId Item da Atividade que gerou o aviso, quando houver.
 */
data class PushTarget(val listId: String?, val route: RouteRef?, val feedId: String?) {
    companion object {
        /** Extra com a lista. */
        const val EXTRA_LIST_ID = "listId"

        /** Extra com a rota em JSON. */
        const val EXTRA_ROUTE = "route"

        /** Extra com o item da Atividade. */
        const val EXTRA_FEED_ID = "feedId"

        /** Os três extras. */
        val EXTRAS = listOf(EXTRA_LIST_ID, EXTRA_ROUTE, EXTRA_FEED_ID)

        private val json = Json { ignoreUnknownKeys = true }

        /**
         * Lê o destino de um push. Valores vazios contam como ausentes; JSON de rota inválido vira
         * rota nula, sem derrubar a abertura do app.
         *
         * @param read Lê um valor pelo nome (extras do Intent ou dados da mensagem).
         * @return O destino, ou null quando não há nenhum dos três valores (abertura comum do app).
         */
        fun parse(read: (String) -> String?): PushTarget? {
            val listId = read(EXTRA_LIST_ID)?.trim()?.takeIf { it.isNotEmpty() }
            val routeJson = read(EXTRA_ROUTE)?.trim()?.takeIf { it.isNotEmpty() }
            val feedId = read(EXTRA_FEED_ID)?.trim()?.takeIf { it.isNotEmpty() }
            if (listId == null && routeJson == null && feedId == null) return null
            return PushTarget(listId = listId, route = routeJson?.let(::parseRoute), feedId = feedId)
        }

        /**
         * Lê uma [RouteRef] em JSON.
         *
         * @param text JSON como `{"name":"movie","args":{"tmdbId":603}}`.
         * @return A rota, ou null se o texto não for uma rota válida.
         */
        fun parseRoute(text: String): RouteRef? = try {
            json.decodeFromString(RouteRef.serializer(), text).takeIf { it.name.isNotBlank() }
        } catch (_: IllegalArgumentException) {
            // SerializationException é uma IllegalArgumentException.
            null
        }
    }
}
