package io.github.guilhermetelles.lombada.ui.quiz

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.model.QuizDoc
import io.github.guilhermetelles.lombada.data.model.Scores
import io.github.guilhermetelles.lombada.domain.BrazilDay
import io.github.guilhermetelles.lombada.domain.QuizEvent
import io.github.guilhermetelles.lombada.domain.QuizRules
import io.github.guilhermetelles.lombada.ui.SCREEN_SHARING
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
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
 * @property history Perguntas dos dias anteriores e as do evento de início já respondidas, da mais nova
 *   para a mais antiga (as do evento entram pelo dia em que a pessoa respondeu).
 * @property event Perguntas do evento de início e as próprias respostas.
 */
data class QuizTabState(
    val loading: Boolean = true,
    val clock: QuizClock = currentClock(),
    val today: QuizDoc? = null,
    val todayAnswers: DayAnswers = DayAnswers.NONE,
    val scores: Scores? = null,
    val history: List<QuizHistoryItem> = emptyList(),
    val event: QuizEventState = QuizEventState()
)

private const val HISTORY_SIZE = 7L
private const val CLOCK_TICK_MS = 30_000L

private fun currentClock() = QuizClock(BrazilDay.todayId(), BrazilDay.monthId(), QuizRules.beforeRelease())

/**
 * Aba Quiz: o evento de início, a pergunta de hoje, o placar do mês e o histórico, em tempo real. Vira o dia sozinha.
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
                    history(now.day),
                    observeQuizEvent(container.quiz, listId, uid)
                ) { today, answers, scores, history, event ->
                    QuizTabState(false, now, today, answers, scores, history, event)
                }
            }.stateIn(viewModelScope, SCREEN_SHARING, QuizTabState())

    private fun history(today: String): Flow<List<QuizHistoryItem>> =
        combine(dailyHistory(today), eventHistory()) { daily, event ->
            // Chave de ordem: o dia da pergunta, ou o dia em que a pessoa respondeu a do evento.
            (daily + event).sortedWith(
                compareByDescending<QuizHistoryItem> { historyDay(it) }.thenByDescending { it.quiz.eventIndex ?: 0 }
            )
        }

    private fun historyDay(item: QuizHistoryItem): String = if (item.quiz.event == null) {
        item.quiz.day
    } else {
        item.answers.mine?.answeredAt?.let { BrazilDay.of(it).toString() } ?: item.quiz.day
    }

    // Perguntas do evento já respondidas, com as respostas de todos e a certa quando dá para saber.
    private fun eventHistory(): Flow<List<QuizHistoryItem>> = observeQuizEvent(container.quiz, listId, uid)
        .map { event -> event.items.filter { it.mine != null }.map { it.quiz } }
        .distinctUntilChanged()
        .flatMapLatest { quizzes -> historyItems(quizzes) }
        .catch { emit(emptyList()) }

    private fun dailyHistory(today: String): Flow<List<QuizHistoryItem>> = container.quiz
        // As do evento também têm `day`: busca a mais para sobrar o bastante depois de tirá-las.
        .observeRecent(listId, HISTORY_SIZE + 1 + QuizEvent.SIZE)
        .map { quizzes ->
            quizzes.filter { it.event == null && !QuizEvent.isEventId(it.id) && it.day < today }
                .take(HISTORY_SIZE.toInt())
        }
        .distinctUntilChanged()
        .flatMapLatest { quizzes -> historyItems(quizzes) }
        .onStart { emit(emptyList()) }
        .catch { emit(emptyList()) }

    private fun historyItems(quizzes: List<QuizDoc>): Flow<List<QuizHistoryItem>> = if (quizzes.isEmpty()) {
        flowOf(emptyList())
    } else {
        combine(
            quizzes.map { quiz ->
                observeDayAnswers(container.quiz, listId, quiz.id, uid).map { answers ->
                    val remembered = cache.read(listId, quiz.id)?.rightOptionId
                    QuizHistoryItem(quiz, answers, QuizRules.rightOption(remembered, answers.all))
                }
            }
        ) { it.toList() }
    }
}
