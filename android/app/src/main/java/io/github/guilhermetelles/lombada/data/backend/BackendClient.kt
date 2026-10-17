package io.github.guilhermetelles.lombada.data.backend

import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.HttpException
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

/**
 * Cliente do backend: toda falha vira [BackendException], num lugar só.
 *
 * @param api Rotas, montadas por [create].
 */
class BackendClient(private val api: BackendApi) {
    /**
     * Busca filmes.
     *
     * @param query Termo digitado.
     * @return Resultados do TMDb.
     * @throws BackendException Em qualquer falha.
     */
    suspend fun searchMovies(query: String): List<MovieSearchResult> = call { api.searchMovies(query).results }

    /**
     * Busca atores e diretores.
     *
     * @param query Termo com pelo menos 2 caracteres.
     * @return Até 5 pessoas.
     * @throws BackendException Em qualquer falha.
     */
    suspend fun searchPeople(query: String): List<PersonSearchResult> = call { api.searchPeople(query).results }

    /**
     * Garante o filme no banco com os dados em dia.
     *
     * @param tmdbId Id do filme no TMDb.
     * @return Os campos da cópia resumida.
     * @throws BackendException Em qualquer falha.
     */
    suspend fun refreshMovie(tmdbId: Int): MovieResponse = call { api.refreshMovie(tmdbId) }

    /**
     * Garante a ficha da pessoa no banco, em dia.
     *
     * @param personId Id da pessoa no TMDb.
     * @throws BackendException Em qualquer falha.
     */
    suspend fun refreshPerson(personId: Int) {
        call { api.refreshPerson(personId).orThrow() }
    }

    /**
     * Cria uma lista.
     *
     * @param name Nome.
     * @param description Descrição, pode ser vazia.
     * @return Id da lista e o primeiro código.
     * @throws BackendException Em qualquer falha.
     */
    suspend fun createList(name: String, description: String): CreatedListResponse =
        call { api.createList(CreateListRequest(name, description)) }

    /**
     * Entra numa lista.
     *
     * @param code Código normalizado.
     * @return A lista em que entrou.
     * @throws BackendException `NOT_FOUND` ou `INVITE_EXPIRED` para código ruim, entre outras.
     */
    suspend fun joinList(code: String): JoinedListResponse = call { api.joinList(JoinListRequest(code)) }

    /**
     * Gera um código novo.
     *
     * @param listId Lista.
     * @return Código e validade.
     * @throws BackendException Em qualquer falha.
     */
    suspend fun createInvite(listId: String): CreatedInviteResponse = call { api.createInvite(listId) }

    /**
     * Sai da lista.
     *
     * @param listId Lista.
     * @return Se a lista foi apagada por ter ficado vazia.
     * @throws BackendException Em qualquer falha.
     */
    suspend fun leaveList(listId: String): LeftListResponse = call { api.leaveList(listId) }

    /**
     * Apaga a lista.
     *
     * @param listId Lista.
     * @throws BackendException `FORBIDDEN` para quem não é dono, entre outras.
     */
    suspend fun deleteList(listId: String) {
        call { api.deleteList(listId).orThrow() }
    }

    private fun retrofit2.Response<Unit>.orThrow() {
        if (!isSuccessful) throw HttpException(this)
    }

    private suspend fun <T> call(block: suspend () -> T): T = try {
        block()
    } catch (error: HttpException) {
        throw toBackendException(error)
    } catch (error: IOException) {
        throw BackendException(BackendErrorCode.NETWORK, "Sem conexão com o servidor.", cause = error)
    } catch (error: kotlinx.serialization.SerializationException) {
        throw BackendException(BackendErrorCode.UNKNOWN, "Resposta inesperada do servidor.", cause = error)
    }

    private fun toBackendException(error: HttpException): BackendException {
        val body = error.response()?.errorBody()?.string()
        val detail = body?.let { runCatching { json.decodeFromString<ErrorBody>(it).error }.getOrNull() }
        return BackendException(
            code = detail?.code?.let(BackendErrorCode::fromWire) ?: BackendErrorCode.UNKNOWN,
            message = detail?.message ?: "Erro ${error.code()} do servidor.",
            status = error.code(),
            cause = error
        )
    }

    companion object {
        private val json = Json { ignoreUnknownKeys = true }

        /**
         * Monta o cliente com o interceptor do token.
         *
         * @param baseUrl Endereço do backend, terminado em `/`.
         * @param tokenInterceptor Interceptor que põe o ID token.
         * @return Cliente pronto.
         */
        fun create(baseUrl: String, tokenInterceptor: IdTokenInterceptor): BackendClient {
            val http =
                OkHttpClient
                    .Builder()
                    .addInterceptor(tokenInterceptor)
                    // A primeira busca de um filme junta TMDb, Letterboxd e OMDb e pode passar de 10s.
                    .readTimeout(30, TimeUnit.SECONDS)
                    // Teto para o pedido inteiro, com as novas tentativas de conexão do OkHttp.
                    .callTimeout(40, TimeUnit.SECONDS)
                    .build()
            val retrofit =
                Retrofit
                    .Builder()
                    .baseUrl(baseUrl)
                    .client(http)
                    .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
                    .build()
            return BackendClient(retrofit.create(BackendApi::class.java))
        }
    }
}
