package io.github.guilhermetelles.lombada.data.backend

import io.github.guilhermetelles.lombada.data.model.NotifyPrefs
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.HTTP
import retrofit2.http.POST
import retrofit2.http.PUT
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

    /** Garante o filme no banco, com os dados em dia; com `listId`, devolve também a compatibilidade. */
    @GET("api/movies/{tmdbId}")
    suspend fun refreshMovie(@Path("tmdbId") tmdbId: Int, @Query("listId") listId: String?): MovieResponse

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

    /** Sincroniza nome e foto da conta em `memberProfiles` das listas. */
    @GET("api/me")
    suspend fun me(): MeResponse

    /** Registra o token do FCM deste aparelho. */
    @POST("api/me/devices")
    suspend fun registerDevice(@Body body: RegisterDeviceRequest): Response<Unit>

    /** Remove o token do FCM deste aparelho. */
    @HTTP(method = "DELETE", path = "api/me/devices", hasBody = true)
    suspend fun unregisterDevice(@Body body: UnregisterDeviceRequest): Response<Unit>

    /** Preferências de notificação. */
    @GET("api/me/notify")
    suspend fun getNotifyPrefs(): NotifyPrefs

    /** Grava as preferências de notificação. */
    @PUT("api/me/notify")
    suspend fun putNotifyPrefs(@Body body: NotifyPrefs): NotifyPrefs

    /** Manda uma notificação de teste aos aparelhos da pessoa. */
    @POST("api/me/notify-test")
    suspend fun notifyTest(): NotifyTestResponse

    /** Busca avançada; listas separadas por vírgula. */
    @GET("api/discover")
    suspend fun discover(
        @Query("listId") listId: String,
        @Query("mood") mood: String?,
        @Query("dur") dur: String?,
        @Query("dec") dec: String?,
        @Query("genre") genre: String?,
        @Query("theme") theme: String?,
        @Query("svc") svc: String?,
        @Query("fit") fit: Boolean?,
        @Query("page") page: Int?
    ): DiscoverResponse

    /** Interpreta um texto livre como filtros. */
    @POST("api/search/interpret")
    suspend fun interpret(@Body body: InterpretRequest): InterpretResponse

    /** Põe um filme na fila "Quero ver". */
    @POST("api/lists/{listId}/queue")
    suspend fun addToQueue(@Path("listId") listId: String, @Body body: QueueAddRequest): QueueAddResponse

    /** Tira um filme da fila. */
    @DELETE("api/lists/{listId}/queue/{tmdbId}")
    suspend fun removeFromQueue(@Path("listId") listId: String, @Path("tmdbId") tmdbId: Int): Response<Unit>

    /** Manda um lote de eventos da lista (atividade e push para o outro membro). */
    @POST("api/lists/{listId}/events")
    suspend fun sendEvents(@Path("listId") listId: String, @Body body: ListEventsRequest): ListEventsResponse

    /** Responde ao quiz do dia. */
    @POST("api/lists/{listId}/quiz/{day}/answer")
    suspend fun answerQuiz(
        @Path("listId") listId: String,
        @Path("day") day: String,
        @Body body: QuizAnswerRequest
    ): QuizAnswerResponse
}
