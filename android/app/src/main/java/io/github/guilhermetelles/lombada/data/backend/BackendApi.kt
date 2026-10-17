package io.github.guilhermetelles.lombada.data.backend

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/** Rotas do backend (tabela de rotas de `docs/plano-backend.md`). Todas exigem o ID token. */
interface BackendApi {
    /** Busca de filmes para adicionar. */
    @GET("api/search")
    suspend fun searchMovies(@Query("q") query: String): MovieSearchResponse

    /** Grupo "Pessoas" da busca. */
    @GET("api/search/people")
    suspend fun searchPeople(@Query("q") query: String): PersonSearchResponse

    /** Garante o filme no banco, com os dados em dia. */
    @GET("api/movies/{tmdbId}")
    suspend fun refreshMovie(@Path("tmdbId") tmdbId: Int): MovieResponse

    /** Garante a ficha da pessoa no banco, em dia. O app lê a ficha do Firestore. */
    @GET("api/people/{personId}")
    suspend fun refreshPerson(@Path("personId") personId: Int): Response<Unit>

    /** Cria uma lista. */
    @POST("api/lists")
    suspend fun createList(@Body body: CreateListRequest): CreatedListResponse

    /** Entra numa lista com um código. */
    @POST("api/lists/join")
    suspend fun joinList(@Body body: JoinListRequest): JoinedListResponse

    /** Gera um código novo. */
    @POST("api/lists/{listId}/invites")
    suspend fun createInvite(@Path("listId") listId: String): CreatedInviteResponse

    /** Sai da lista. */
    @POST("api/lists/{listId}/leave")
    suspend fun leaveList(@Path("listId") listId: String): LeftListResponse

    /** Apaga a lista (só quem é dono). */
    @DELETE("api/lists/{listId}")
    suspend fun deleteList(@Path("listId") listId: String): Response<Unit>
}
