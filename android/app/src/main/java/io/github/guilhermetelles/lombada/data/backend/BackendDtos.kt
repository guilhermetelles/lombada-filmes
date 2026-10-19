package io.github.guilhermetelles.lombada.data.backend

import io.github.guilhermetelles.lombada.data.model.DiscoverItem
import io.github.guilhermetelles.lombada.data.model.Filters
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

/** Compatibilidade do filme com a lista, de 0 a 100, em `GET /api/movies/{tmdbId}?listId=`. */
@Serializable
data class CompatDto(val score: Double, val reason: String)

/**
 * O que o app usa da resposta de `GET /api/movies/{tmdbId}`: os campos da cópia resumida e, com
 * `listId`, a compatibilidade. Os campos novos do filme o app lê de `movies/{tmdbId}`.
 */
@Serializable
data class MovieResponse(
    val tmdbId: Int,
    val title: String,
    val year: Int? = null,
    val posterPath: String? = null,
    val directors: List<PersonRefDto> = emptyList(),
    val ratings: MovieRatingsDto = MovieRatingsDto(),
    val compat: CompatDto? = null,
    val titlePt: String? = null
)

/** Resposta de `GET /api/me`: quantas listas tiveram nome e foto sincronizados. */
@Serializable
data class MeResponse(val uid: String, val profileSynced: Int = 0)

/** Corpo de `POST /api/me/devices`. */
@Serializable
data class RegisterDeviceRequest(val token: String, val platform: String = "android")

/** Corpo de `DELETE /api/me/devices`. */
@Serializable
data class UnregisterDeviceRequest(val token: String)

/** Resposta de `POST /api/me/notify-test`: quantos aparelhos receberam. */
@Serializable
data class NotifyTestResponse(val sent: Int)

/** Resposta de `GET /api/discover`. */
@Serializable
data class DiscoverResponse(val results: List<DiscoverItem>, val page: Int = 1, val totalPages: Int = 1)

/** Corpo de `POST /api/search/interpret`, de 2 a 200 caracteres. */
@Serializable
data class InterpretRequest(val text: String)

/**
 * Palavra-chave do TMDb devolvida pelo `interpret`.
 *
 * @property id Id da palavra-chave no TMDb.
 * @property label Rótulo em português, para mostrar.
 */
@Serializable
data class InterpretKeyword(val id: Int, val label: String = "")

/**
 * Resposta de `POST /api/search/interpret`.
 *
 * @property filters Filtros entendidos.
 * @property explanation Frase explicando o que foi entendido.
 * @property keywords De 0 a 5 palavras-chave do TMDb; ausente vira lista vazia.
 */
@Serializable
data class InterpretResponse(
    val filters: Filters,
    val explanation: String = "",
    val keywords: List<InterpretKeyword> = emptyList()
)

/** Corpo de `POST /api/lists/{id}/queue`. */
@Serializable
data class QueueAddRequest(val tmdbId: Int)

/** Resposta de `POST /api/lists/{id}/queue`. */
@Serializable
data class QueueAddResponse(val tmdbId: Int)

/**
 * Um evento da lista para `POST /api/lists/{id}/events`.
 *
 * @property type `added`, `moved`, `commented` ou `removed`.
 * @property entryId Entrada.
 * @property tmdbId Filme, só em `removed`.
 */
@Serializable
data class ListEventDto(val type: String, val entryId: String, val tmdbId: Int? = null)

/** Corpo de `POST /api/lists/{id}/events`, com até 50 eventos. */
@Serializable
data class ListEventsRequest(val items: List<ListEventDto>)

/** Resposta de `POST /api/lists/{id}/events`: se algum push saiu. */
@Serializable
data class ListEventsResponse(val pushed: Boolean)

/** Corpo de `POST /api/lists/{id}/quiz/{dia}/answer`. */
@Serializable
data class QuizAnswerRequest(val optionId: String)

/** Resposta de outro membro que já respondeu, em [QuizAnswerResponse.others]. */
@Serializable
data class QuizOtherAnswer(val uid: String, val correct: Boolean, val optionId: String)

/** Resposta de `POST /api/lists/{id}/quiz/{dia}/answer`. */
@Serializable
data class QuizAnswerResponse(
    val correct: Boolean,
    val rightOptionId: String,
    val explanation: String = "",
    val others: List<QuizOtherAnswer> = emptyList()
)

/** Corpo de erro do backend: `{ "error": { "code", "message" } }`. */
@Serializable
data class ErrorBody(val error: ErrorDetail)

/** Detalhe do erro. */
@Serializable
data class ErrorDetail(val code: String, val message: String)
