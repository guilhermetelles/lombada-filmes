package io.github.guilhermetelles.lombada.data.model

import java.time.LocalDate

/**
 * Pessoa citada num filme: id do TMDb e nome.
 *
 * @property id Id da pessoa no TMDb.
 * @property name Nome.
 */
data class PersonRef(val id: Int, val name: String)

/**
 * Cópia resumida de `movies/{tmdbId}` guardada na entrada, para a lista abrir lendo só as entradas.
 *
 * @property title Título a mostrar: no Firestore, em inglês; o app troca pelo do idioma escolhido ao ler
 *   (`MovieTitles.localize`).
 * @property year Ano de lançamento.
 * @property posterPath Caminho da capa no TMDb.
 * @property imdb Nota do IMDb, de 0 a 10.
 * @property letterboxd Nota do Letterboxd, de 0 a 5.
 * @property directors Até 8 diretores.
 * @property titleAlt Título em inglês quando [title] foi trocado pelo português (só no app, nunca gravado).
 */
data class MovieSnapshot(
    val title: String,
    val year: Int?,
    val posterPath: String?,
    val imdb: Double?,
    val letterboxd: Double?,
    val directors: List<PersonRef>,
    val titleAlt: String? = null
)

/**
 * Um filme na lista, em `lists/{listId}/entries/{id}`.
 *
 * @property id Id do documento.
 * @property tmdbId Id do filme no TMDb.
 * @property rankKey Chave de ordem fracionária.
 * @property watchedOn Data em que viram, se registrada.
 * @property comment Comentário, pode ser vazio.
 * @property addedBy Quem adicionou.
 * @property movie Cópia resumida do filme.
 */
data class Entry(
    val id: String,
    val tmdbId: Int,
    val rankKey: String,
    val watchedOn: LocalDate?,
    val comment: String,
    val addedBy: String,
    val movie: MovieSnapshot
)
