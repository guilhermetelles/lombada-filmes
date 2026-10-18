package io.github.guilhermetelles.lombada.ui.quiz

import io.github.guilhermetelles.lombada.data.firestore.QuizRepository
import io.github.guilhermetelles.lombada.data.model.QuizAnswer
import io.github.guilhermetelles.lombada.data.model.QuizDoc
import io.github.guilhermetelles.lombada.domain.QuizEvent
import io.github.guilhermetelles.lombada.domain.QuizEventProgress
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.onCompletion
import kotlinx.coroutines.flow.onStart

/**
 * Uma pergunta do evento de início com a própria resposta.
 *
 * @property quiz Pergunta.
 * @property mine A própria resposta, ou null se ainda não respondeu.
 */
data class QuizEventItem(val quiz: QuizDoc, val mine: QuizAnswer?)

/**
 * Perguntas do evento de início e o que a pessoa já respondeu.
 *
 * @property items Perguntas na ordem do evento; vazio enquanto o backend não gravou.
 */
data class QuizEventState(val items: List<QuizEventItem> = emptyList()) {
    /** Respondidas, acertos e total. */
    val progress: QuizEventProgress
        get() = QuizEvent.progress(
            items.map { it.quiz.id },
            items.mapNotNull { item -> item.mine?.let { item.quiz.id to it.correct } }.toMap()
        )

    /** Ids já respondidos. */
    val answeredIds: Set<String> get() = items.filter { it.mine != null }.map { it.quiz.id }.toSet()

    /**
     * Próxima pergunta não respondida.
     *
     * @param after Pergunta atual, que conta como respondida.
     * @return O id, ou null quando não falta nenhuma.
     */
    fun nextUnanswered(after: String? = null): String? =
        QuizEvent.nextUnanswered(items.map { it.quiz.id }, answeredIds, after)
}

/**
 * Acompanha as perguntas do evento de início e a própria resposta de cada uma. Nunca termina sem
 * emitir, para poder ser combinado com outros fluxos.
 *
 * @param quiz Repositório do quiz.
 * @param listId Lista.
 * @param uid Pessoa logada.
 * @return Fluxo do evento; vazio enquanto não há perguntas ou se a leitura falhar.
 */
@OptIn(ExperimentalCoroutinesApi::class)
fun observeQuizEvent(quiz: QuizRepository, listId: String, uid: String): Flow<QuizEventState> = quiz
    .observeEvent(listId, QuizEvent.NAME)
    .distinctUntilChanged()
    .flatMapLatest { quizzes ->
        if (quizzes.isEmpty()) {
            flowOf(QuizEventState())
        } else {
            combine(
                quizzes.map { doc ->
                    // Sem valor inicial falso: a pergunta só conta como pendente depois de ler a resposta.
                    quiz
                        .observeMyAnswer(listId, doc.id, uid)
                        .onCompletion { cause -> if (cause == null) emit(null) }
                        .catch { emit(null) }
                }
            ) { answers -> QuizEventState(quizzes.zip(answers.toList()) { doc, mine -> QuizEventItem(doc, mine) }) }
        }
    }.onStart { emit(QuizEventState()) }
    .catch { emit(QuizEventState()) }
