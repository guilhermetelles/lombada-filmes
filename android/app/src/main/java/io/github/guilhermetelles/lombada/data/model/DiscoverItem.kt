package io.github.guilhermetelles.lombada.data.model

import kotlinx.serialization.Serializable

/**
 * Um filme da busca avançada (`GET /api/discover`).
 *
 * @property tmdbId Filme.
 * @property title Título.
 * @property year Ano.
 * @property posterPath Capa.
 * @property runtime Duração em minutos.
 * @property genres Gêneros em português.
 * @property providers Streaming por assinatura no Brasil.
 * @property score Compatibilidade, de 0 a 100.
 * @property reason Frase curta com o motivo.
 * @property trending Se está em alta.
 * @property inListEntryId Entrada da lista com este filme, quando já foi visto.
 * @property matchedKeywords Ids das palavras-chave pedidas (`kw`) que o filme tem; vazio quando não se sabe.
 */
@Serializable
data class DiscoverItem(
    val tmdbId: Int,
    val title: String,
    val year: Int? = null,
    val posterPath: String? = null,
    val runtime: Int? = null,
    val genres: List<String> = emptyList(),
    val providers: List<String> = emptyList(),
    val score: Double = 0.0,
    val reason: String = "",
    val trending: Boolean = false,
    val inListEntryId: String? = null,
    val matchedKeywords: List<Int> = emptyList()
)
