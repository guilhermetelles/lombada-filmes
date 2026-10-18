package io.github.guilhermetelles.lombada.ui.quiz

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.model.QuizDoc
import io.github.guilhermetelles.lombada.data.model.Scores
import io.github.guilhermetelles.lombada.domain.BrazilDay
import io.github.guilhermetelles.lombada.domain.QuizRules
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.stateIn

/**
 * Relógio do quiz: o dia de hoje e o mês em Brasília e se a pergunta já saiu.
 *
 * @property day Hoje `AAAA-MM-DD`.
 * @property month Este mês `AAAA-MM`.
 * @property beforeRelease Se ainda não deu 05h30.
 */
data class QuizClock(val day: String, val month: String, val beforeRelease: Boolean)

/**
 * Uma pergunta passada no histórico.
 *
 * @property quiz Pergunta.
 * @property answers Respostas que a pessoa pode ler.
 * @property rightOptionId Certa, quando se sabe (resposta neste aparelho ou alguém acertou).
 */
data class QuizHistoryItem(val quiz: QuizDoc, val answers: DayAnswers, val rightOptionId: String?)

/**
 * Estado da aba Quiz.
 *
 * @property loading Se a pergunta de hoje ainda está carregando.
 * @property clock Dia, mês e horário.
 * @property today Pergunta de hoje, ou null antes da rotina.
 * @property todayAnswers Respostas de hoje.
 * @property scores Placar do mês, ou null antes da primeira resposta.
 * @property history Perguntas dos dias anteriores, da mais nova para a mais antiga.
 */
data class QuizTabState(
    val loading: Boolean = true,
    val clock: QuizClock = currentClock(),
    val today: QuizDoc? = null,
    val todayAnswers: DayAnswers = DayAnswers.NONE,
    val scores: Scores? = null,
    val history: List<QuizHistoryItem> = emptyList()
)

private const val HISTORY_SIZE = 7L
private const val CLOCK_TICK_MS = 30_000L

private fun currentClock() = QuizClock(BrazilDay.todayId(), BrazilDay.monthId(), QuizRules.beforeRelease())

/**
 * Aba Quiz: a pergunta de hoje, o placar do mês e o histórico, em tempo real. Vira o dia sozinha.
 *
 * @param container Dependências do app.
 * @param cache Resultados guardados das respostas dadas neste aparelho.
 * @param listId Lista ativa.
 * @param uid Pessoa logada.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class QuizViewModel(
    private val container: AppContainer,
    private val cache: QuizResultCache,
    private val listId: String,
    private val uid: String
) : ViewModel() {
    private val clock: Flow<QuizClock> =
        flow {
            while (true) {
                emit(currentClock())
                delay(CLOCK_TICK_MS)
            }
        }.distinctUntilChanged()

    /** Estado da tela. */
    val state: StateFlow<QuizTabState> =
        clock
            .flatMapLatest { now ->
                combine(
                    container.quiz.observeQuiz(listId, now.day).catch { emit(null) },
                    observeDayAnswers(container.quiz, listId, now.day, uid),
                    container.scores.observe(listId, now.month).onStart { emit(null) }.catch { emit(null) },
                    history(now.day)
                ) { today, answers, scores, history ->
                    QuizTabState(false, now, today, answers, scores, history)
                }
            }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), QuizTabState())

    private fun history(today: String): Flow<List<QuizHistoryItem>> = container.quiz
        .observeRecent(listId, HISTORY_SIZE + 1)
        .map { quizzes -> quizzes.filter { it.day < today }.take(HISTORY_SIZE.toInt()) }
        .distinctUntilChanged()
        .flatMapLatest { quizzes ->
            if (quizzes.isEmpty()) {
                flowOf(emptyList())
            } else {
                combine(
                    quizzes.map { quiz ->
                        observeDayAnswers(container.quiz, listId, quiz.day, uid).map { answers ->
                            val remembered = cache.read(listId, quiz.day)?.rightOptionId
                            QuizHistoryItem(quiz, answers, QuizRules.rightOption(remembered, answers.all))
                        }
                    }
                ) { it.toList() }
            }
        }.onStart { emit(emptyList()) }
        .catch { emit(emptyList()) }
}
