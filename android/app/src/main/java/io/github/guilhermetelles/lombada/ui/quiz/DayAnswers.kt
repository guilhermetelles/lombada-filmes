package io.github.guilhermetelles.lombada.ui.quiz

import io.github.guilhermetelles.lombada.data.firestore.QuizRepository
import io.github.guilhermetelles.lombada.data.model.QuizAnswer
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onCompletion
import kotlinx.coroutines.flow.onStart

/**
 * Respostas de um dia que a pessoa pode ler.
 *
 * @property mine A própria resposta, ou null antes de responder.
 * @property others As dos outros membros; vazio antes de responder (as regras não deixam ler).
 */
data class DayAnswers(val mine: QuizAnswer?, val others: List<QuizAnswer>) {
    /** Todas as respostas legíveis. */
    val all: List<QuizAnswer> get() = listOfNotNull(mine) + others

    companion object {
        /** Sem nenhuma resposta. */
        val NONE = DayAnswers(null, emptyList())
    }
}

/**
 * Acompanha as respostas de um dia: a própria sempre e, só depois dela existir, as dos outros.
 * Nunca termina sem emitir, para poder ser combinado com outros fluxos.
 *
 * @param quiz Repositório do quiz.
 * @param listId Lista.
 * @param day Dia `AAAA-MM-DD`.
 * @param uid Pessoa logada.
 * @return Fluxo das respostas.
 */
@OptIn(ExperimentalCoroutinesApi::class)
fun observeDayAnswers(quiz: QuizRepository, listId: String, day: String, uid: String): Flow<DayAnswers> = quiz
    .observeMyAnswer(listId, day, uid)
    .onCompletion { cause -> if (cause == null) emit(null) }
    .flatMapLatest { mine ->
        if (mine == null) {
            flowOf(DayAnswers.NONE)
        } else {
            quiz
                .observeAnswers(listId, day)
                .map { list -> DayAnswers(mine, list.filter { it.uid != uid }) }
                .onStart { emit(DayAnswers(mine, emptyList())) }
        }
    }.catch { emit(DayAnswers.NONE) }
