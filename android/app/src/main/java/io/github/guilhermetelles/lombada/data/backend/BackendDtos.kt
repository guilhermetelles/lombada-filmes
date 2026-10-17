package io.github.guilhermetelles.lombada.data.backend

import kotlinx.serialization.Serializable

/** Corpo de `POST /api/lists`. */
@Serializable
data class CreateListRequest(val name: String, val description: String)

/** Resposta de `POST /api/lists`: a lista nova e o primeiro código de convite. */
@Serializable
data class CreatedListResponse(val listId: String, val inviteCode: String, val expiresAt: String)

/** Corpo de `POST /api/lists/join`. */
@Serializable
data class JoinListRequest(val code: String)

/** Resposta de `POST /api/lists/join`. */
@Serializable
data class JoinedListResponse(val listId: String, val name: String, val description: String, val alreadyMember: Boolean)

/** Resposta de `POST /api/lists/{id}/invites`. */
@Serializable
data class CreatedInviteResponse(val inviteCode: String, val expiresAt: String)

/** Resposta de `POST /api/lists/{id}/leave`. */
@Serializable
data class LeftListResponse(val listDeleted: Boolean)

/** Um filme na busca do TMDb. */
@Serializable
data class MovieSearchResult(
    val tmdbId: Int,
    val title: String,
    val originalTitle: String? = null,
    val year: Int? = null,
    val posterPath: String? = null,
    val overview: String? = null
)

/** Resposta de `GET /api/search`. */
@Serializable
data class MovieSearchResponse(val results: List<MovieSearchResult>)

/** Uma pessoa na busca do TMDb; `department` é `acting` ou `directing`. */
@Serializable
data class PersonSearchResult(
    val personId: Int,
    val name: String,
    val department: String,
    val profilePath: String? = null,
    val knownFor: List<String> = emptyList()
)

/** Resposta de `GET /api/search/people`. */
@Serializable
data class PersonSearchResponse(val results: List<PersonSearchResult>)

/** Pessoa citada num filme. */
@Serializable
data class PersonRefDto(val id: Int, val name: String)

/** Notas de uma fonte, como o backend devolve. */
@Serializable
data class RatingDto(val value: Double? = null)

/** Notas do filme; só as duas da cópia resumida importam para o app. */
@Serializable
data class MovieRatingsDto(val imdb: RatingDto? = null, val letterboxd: RatingDto? = null)

/** O que o app usa da resposta de `GET /api/movies/{tmdbId}`: os campos da cópia resumida. */
@Serializable
data class MovieResponse(
    val tmdbId: Int,
    val title: String,
    val year: Int? = null,
    val posterPath: String? = null,
    val directors: List<PersonRefDto> = emptyList(),
    val ratings: MovieRatingsDto = MovieRatingsDto()
)

/** Corpo de erro do backend: `{ "error": { "code", "message" } }`. */
@Serializable
data class ErrorBody(val error: ErrorDetail)

/** Detalhe do erro. */
@Serializable
data class ErrorDetail(val code: String, val message: String)
