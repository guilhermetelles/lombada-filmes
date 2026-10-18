package io.github.guilhermetelles.lombada.ui.quiz

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.backend.BackendErrorCode
import io.github.guilhermetelles.lombada.data.backend.BackendException
import io.github.guilhermetelles.lombada.data.model.QuizAnswer
import io.github.guilhermetelles.lombada.data.model.QuizDoc
import io.github.guilhermetelles.lombada.domain.BrazilDay
import io.github.guilhermetelles.lombada.domain.QuizEvent
import io.github.guilhermetelles.lombada.domain.QuizRules
import java.time.Instant
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Estado da tela da pergunta.
 *
 * @property loading Se a pergunta ainda está carregando.
 * @property day Id da pergunta: o dia `AAAA-MM-DD`, ou `inicio-NN` no evento de início.
 * @property isToday Se é a pergunta de hoje (das diárias, só ela aceita resposta).
 * @property isEvent Se é uma pergunta do evento de início, que aceita resposta em qualquer dia.
 * @property eventIndex Número da pergunta no evento, de 1 a 10; null fora dele.
 * @property nextEventId Próxima pergunta do evento ainda sem resposta, sem contar esta; null se não falta nenhuma.
 * @property quiz Pergunta, ou null se não existe.
 * @property mine A própria resposta, ou null antes de responder.
 * @property sendingOptionId Alternativa enviada, esperando o backend.
 * @property rightOptionId Certa, quando se sabe.
 * @property explanation Explicação, quando a resposta foi dada neste aparelho.
 * @property others Respostas dos outros membros que já responderam (só depois de responder).
 * @property error Falha do último envio, para mostrar perto das alternativas.
 * @property dayClosed Se o backend recusou porque o dia já virou.
 */
data class QuizPlayState(
    val loading: Boolean = true,
    val day: String = "",
    val isToday: Boolean = true,
    val isEvent: Boolean = false,
    val eventIndex: Int? = null,
    val nextEventId: String? = null,
    val quiz: QuizDoc? = null,
    val mine: QuizAnswer? = null,
    val sendingOptionId: String? = null,
    val rightOptionId: String? = null,
    val explanation: String? = null,
    val others: List<QuizAnswer> = emptyList(),
    val error: String? = null,
    val dayClosed: Boolean = false
) {
    /** Se a pessoa ainda pode responder. */
    val canAnswer: Boolean
        get() = quiz != null && mine == null && open && !dayClosed && sendingOptionId == null

    /** Se a pergunta ainda aceita resposta de alguém: a de hoje ou uma do evento. */
    val open: Boolean get() = isToday || isEvent
}

// Resultado da resposta dada agora, antes do Firestore devolver o documento.
private data class LocalResult(val mine: QuizAnswer, val result: QuizResult, val others: List<QuizAnswer>)

private data class SendState(val optionId: String? = null, val error: String? = null, val dayClosed: Boolean = false)

/**
 * Pergunta de um dia ou do evento de início: carrega, envia a resposta (`POST …/quiz/{id}/answer`) e
 * mostra o resultado, o da própria pessoa e o dos outros membros, que chega pelo Firestore depois de
 * responder. No evento, acompanha também as outras perguntas, para oferecer a próxima.
 *
 * @param container Dependências do app.
 * @param cache Resultados guardados das respostas dadas neste aparelho.
 * @param listId Lista ativa.
 * @param uid Pessoa logada.
 * @param day Id da pergunta: o dia `AAAA-MM-DD` ou `inicio-NN`.
 */
class QuizPlayViewModel(
    private val container: AppContainer,
    private val cache: QuizResultCache,
    private val listId: String,
    private val uid: String,
    private val day: String
) : ViewModel() {
    private val local = MutableStateFlow<LocalResult?>(null)
    private val send = MutableStateFlow(SendState())
    private val isToday = day == BrazilDay.todayId()
    private val isEvent = QuizEvent.isEventId(day)
    private val event =
        if (isEvent) observeQuizEvent(container.quiz, listId, uid) else flowOf(QuizEventState())

    /** Estado da tela. */
    val state: StateFlow<QuizPlayState> =
        combine(
            container.quiz.observeQuiz(listId, day).catch { emit(null) },
            observeDayAnswers(container.quiz, listId, day, uid),
            local,
            send,
            event
        ) { quiz, answers, localResult, sending, eventState ->
            val mine = answers.mine ?: localResult?.mine
            // Os outros pelo Firestore; os que o backend devolveu e ainda não chegaram completam.
            val others =
                answers.others + localResult?.others.orEmpty().filter { o -> answers.others.none { it.uid == o.uid } }
            val result = localResult?.result ?: cache.read(listId, day)
            QuizPlayState(
                loading = false,
                day = day,
                isToday = isToday,
                isEvent = isEvent,
                eventIndex = quiz?.eventIndex ?: QuizEvent.indexOf(day),
                nextEventId = eventState.nextUnanswered(after = day),
                quiz = quiz,
                mine = mine,
                sendingOptionId = sending.optionId,
                rightOptionId = QuizRules.rightOption(result?.rightOptionId, listOfNotNull(mine) + others),
                explanation = result?.explanation?.takeIf { it.isNotBlank() },
                others = others,
                error = sending.error,
                dayClosed = sending.dayClosed
            )
        }.stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(5_000),
            QuizPlayState(day = day, isToday = isToday, isEvent = isEvent, eventIndex = QuizEvent.indexOf(day))
        )

    /**
     * Responde. Sem efeito se já respondeu, se a pergunta fechou ou se outra resposta está indo.
     *
     * @param optionId Alternativa escolhida.
     */
    fun answer(optionId: String) {
        if (!state.value.canAnswer) return
        send.value = SendState(optionId = optionId)
        viewModelScope.launch {
            try {
                val response = container.backend.answerQuiz(listId, day, optionId)
                val result = QuizResult(response.rightOptionId, response.explanation)
                cache.save(listId, day, result)
                local.value =
                    LocalResult(
                        mine = QuizAnswer(uid, optionId, response.correct, Instant.now()),
                        result = result,
                        others = response.others.map { QuizAnswer(it.uid, it.optionId, it.correct, null) }
                    )
                send.value = SendState()
            } catch (error: BackendException) {
                send.value =
                    when {
                        // Já respondeu (em outro aparelho, ou a resposta anterior chegou e a tela não viu):
                        // a resposta guardada chega pelo Firestore.
                        error.status == 409 -> SendState()

                        // O evento vale em qualquer dia: um 400 nele não é "o dia virou".
                        error.status == 400 && error.code != BackendErrorCode.NETWORK && !isEvent ->
                            SendState(dayClosed = true)

                        error.code == BackendErrorCode.NETWORK ->
                            SendState(error = "Sem conexão. Confira a internet e toque de novo na resposta.")

                        else -> SendState(error = "Não deu para enviar a resposta. Tente de novo.")
                    }
                if (error.status == 409) message("Você já tinha respondido esta pergunta.")
            }
        }
    }

    /** Fecha o aviso de erro. */
    fun clearError() {
        send.update { it.copy(error = null) }
    }

    private fun message(text: String) {
        container.appScope.launch { container.snackbar.showSnackbar(text) }
    }
}
