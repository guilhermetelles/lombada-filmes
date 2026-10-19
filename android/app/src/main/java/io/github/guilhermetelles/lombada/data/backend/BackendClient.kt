package io.github.guilhermetelles.lombada.data.backend

import io.github.guilhermetelles.lombada.data.model.Filters
import io.github.guilhermetelles.lombada.data.model.NotifyPrefs
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
     * @param lang `en` para títulos em inglês; null para o padrão (português).
     * @return Resultados do TMDb.
     * @throws BackendException Em qualquer falha.
     */
    suspend fun searchMovies(query: String, lang: String? = null): List<MovieSearchResult> =
        call { api.searchMovies(query, lang).results }

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
     * @param listId Lista para calcular a compatibilidade ([MovieResponse.compat]); null para não calcular.
     * @return Os campos da cópia resumida e, com [listId], a compatibilidade.
     * @throws BackendException Em qualquer falha.
     */
    suspend fun refreshMovie(tmdbId: Int, listId: String? = null): MovieResponse =
        call { api.refreshMovie(tmdbId, listId) }

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

    /**
     * Sincroniza nome e foto da conta Google em `memberProfiles` das listas. Chamar ao abrir o app.
     *
     * @return O uid e quantas listas foram atualizadas.
     * @throws BackendException Em qualquer falha.
     */
    suspend fun me(): MeResponse = call { api.me() }

    /**
     * Registra o token do FCM deste aparelho.
     *
     * @param token Token do FCM.
     * @throws BackendException Em qualquer falha.
     */
    suspend fun registerDevice(token: String) {
        call { api.registerDevice(RegisterDeviceRequest(token)).orThrow() }
    }

    /**
     * Remove o token do FCM deste aparelho, como ao sair da conta.
     *
     * @param token Token do FCM.
     * @throws BackendException Em qualquer falha.
     */
    suspend fun unregisterDevice(token: String) {
        call { api.unregisterDevice(UnregisterDeviceRequest(token)).orThrow() }
    }

    /**
     * Lê as preferências de notificação.
     *
     * @return As preferências; o backend devolve as padrão para quem nunca gravou.
     * @throws BackendException Em qualquer falha.
     */
    suspend fun getNotifyPrefs(): NotifyPrefs = call { api.getNotifyPrefs() }

    /**
     * Grava as preferências de notificação.
     *
     * @param prefs Preferências completas.
     * @return As preferências gravadas.
     * @throws BackendException `INVALID_INPUT` para valor fora do contrato, entre outras.
     */
    suspend fun putNotifyPrefs(prefs: NotifyPrefs): NotifyPrefs = call { api.putNotifyPrefs(prefs) }

    /**
     * Manda uma notificação de teste aos aparelhos da pessoa.
     *
     * @return Quantos aparelhos receberam.
     * @throws BackendException Em qualquer falha.
     */
    suspend fun notifyTest(): Int = call { api.notifyTest().sent }

    /**
     * Busca avançada no TMDb: primeiro os filmes com mais palavras-chave pedidas, depois pela
     * compatibilidade com a lista.
     *
     * @param listId Lista.
     * @param filters Filtros; listas vazias não vão no pedido.
     * @param keywords Parâmetro `kw` (ids de palavras-chave do TMDb separados por vírgula), ou null.
     * @param page Página, a partir de 1.
     * @param lang `en` para títulos em inglês; null para o padrão (português).
     * @return Os filmes e a paginação.
     * @throws BackendException Em qualquer falha.
     */
    suspend fun discover(
        listId: String,
        filters: Filters,
        keywords: String? = null,
        page: Int = 1,
        lang: String? = null
    ): DiscoverResponse = call {
        api.discover(
            listId = listId,
            mood = filters.mood.joinedOrNull(),
            dur = filters.dur.joinedOrNull(),
            dec = filters.dec.joinedOrNull(),
            genre = filters.genre.joinedOrNull(),
            theme = filters.theme.joinedOrNull(),
            svc = filters.svc.joinedOrNull(),
            fit = filters.fit.takeIf { it },
            kw = keywords,
            page = page,
            lang = lang
        )
    }

    /**
     * Interpreta um texto livre como filtros da busca avançada.
     *
     * @param text De 2 a 200 caracteres.
     * @return Os filtros, uma frase explicando e as palavras-chave do TMDb.
     * @throws BackendException `RATE_LIMITED` (429) acima de 30 por pessoa por dia, entre outras.
     */
    suspend fun interpret(text: String): InterpretResponse = call { api.interpret(InterpretRequest(text)) }

    /**
     * Põe um filme na fila "Quero ver".
     *
     * @param listId Lista.
     * @param tmdbId Filme.
     * @throws BackendException Em qualquer falha.
     */
    suspend fun addToQueue(listId: String, tmdbId: Int) {
        call { api.addToQueue(listId, QueueAddRequest(tmdbId)) }
    }

    /**
     * Tira um filme da fila.
     *
     * @param listId Lista.
     * @param tmdbId Filme.
     * @throws BackendException Em qualquer falha.
     */
    suspend fun removeFromQueue(listId: String, tmdbId: Int) {
        call { api.removeFromQueue(listId, tmdbId).orThrow() }
    }

    /**
     * Manda um lote de eventos da lista, para a Atividade e o push do outro membro.
     *
     * @param listId Lista.
     * @param items Até 50 eventos.
     * @return Se algum push saiu.
     * @throws BackendException Em qualquer falha.
     */
    suspend fun sendEvents(listId: String, items: List<ListEventDto>): Boolean =
        call { api.sendEvents(listId, ListEventsRequest(items)).pushed }

    /**
     * Responde ao quiz do dia.
     *
     * @param listId Lista.
     * @param day Dia `AAAA-MM-DD` em Brasília; precisa ser hoje.
     * @param optionId Alternativa escolhida.
     * @return Se acertou, a certa, a explicação e as respostas de quem já respondeu.
     * @throws BackendException `ALREADY_ANSWERED` (409) se já respondeu e `NOT_TODAY` (400) se o dia não é hoje.
     */
    suspend fun answerQuiz(listId: String, day: String, optionId: String): QuizAnswerResponse =
        call { api.answerQuiz(listId, day, QuizAnswerRequest(optionId)) }

    private fun List<String>.joinedOrNull(): String? = takeIf { it.isNotEmpty() }?.joinToString(",")

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
        private val json =
            Json {
                ignoreUnknownKeys = true
                // As preferências vão inteiras no PUT, mesmo os campos iguais ao padrão.
                encodeDefaults = true
            }

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
