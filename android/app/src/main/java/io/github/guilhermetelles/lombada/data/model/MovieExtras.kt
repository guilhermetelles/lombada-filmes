package io.github.guilhermetelles.lombada.data.model

import java.time.Instant

/**
 * Coleção (saga) do TMDb a que o filme pertence.
 *
 * @property id Id da coleção no TMDb.
 * @property name Nome.
 */
data class MovieCollection(val id: Int, val name: String)

/**
 * Streaming por assinatura no Brasil, em `movies/{tmdbId}.providersBR`.
 *
 * @property flatrate Serviços em que o filme está hoje.
 * @property previous Serviços da leitura anterior, para notar o que chegou.
 * @property fetchedAt Quando o backend buscou.
 */
data class ProvidersBR(val flatrate: List<String>, val previous: List<String>, val fetchedAt: Instant?)

/**
 * Compatibilidade de um filme com o gosto da lista, calculada pelo backend.
 *
 * @property score De 0 a 100.
 * @property reason Frase curta com o motivo.
 */
data class Compat(val score: Int, val reason: String)
