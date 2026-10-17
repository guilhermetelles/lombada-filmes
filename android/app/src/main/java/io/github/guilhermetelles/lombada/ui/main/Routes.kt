package io.github.guilhermetelles.lombada.ui.main

import kotlinx.serialization.Serializable

/** Lista ativa, a tela inicial. */
@Serializable
object ListRoute

/**
 * Detalhe de um filme. Título, ano e capa vêm junto para a tela abrir na hora, antes do Firestore.
 *
 * @property tmdbId Filme.
 * @property title Título conhecido.
 * @property year Ano conhecido.
 * @property posterPath Capa conhecida.
 */
@Serializable
data class MovieRoute(val tmdbId: Int, val title: String, val year: Int? = null, val posterPath: String? = null)

/**
 * Tela de um diretor ou ator.
 *
 * @property personId Pessoa no TMDb.
 * @property name Nome conhecido.
 * @property profilePath Foto conhecida.
 * @property department `directing` abre como diretor; `acting`, como ator.
 */
@Serializable
data class PersonRoute(
    val personId: Int,
    val name: String,
    val profilePath: String? = null,
    val department: String = "acting"
)
