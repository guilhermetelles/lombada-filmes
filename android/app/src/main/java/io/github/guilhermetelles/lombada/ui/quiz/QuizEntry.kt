package io.github.guilhermetelles.lombada.ui.quiz

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.guilhermetelles.lombada.data.model.MovieList
import io.github.guilhermetelles.lombada.data.model.QuizDoc
import io.github.guilhermetelles.lombada.domain.Formatting
import io.github.guilhermetelles.lombada.domain.QuizRules
import io.github.guilhermetelles.lombada.domain.QuizScoreboard
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.components.LombadaButton
import io.github.guilhermetelles.lombada.ui.components.LombadaButtonStyle
import io.github.guilhermetelles.lombada.ui.feed.EmptyState
import io.github.guilhermetelles.lombada.ui.feed.LoadingBlock
import io.github.guilhermetelles.lombada.ui.feed.ScreenColumn
import io.github.guilhermetelles.lombada.ui.feed.SectionCard
import io.github.guilhermetelles.lombada.ui.feed.memberName
import io.github.guilhermetelles.lombada.ui.main.ListInfoRoute
import io.github.guilhermetelles.lombada.ui.main.QuizPlayRoute
import io.github.guilhermetelles.lombada.ui.main.ScreenContext
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import java.time.LocalDate

/**
 * Aba Quiz: o evento de início (quando há), a pergunta de hoje, o placar do mês e o histórico. Ponto de entrada do pacote, registrado no `MainScreen`.
 *
 * @param context Lista, pessoa logada e navegação.
 */
@Composable
fun QuizEntry(context: ScreenContext) {
    val container = appContainer()
    val appContext = LocalContext.current.applicationContext
    val list = context.list
    val viewModel =
        viewModel(key = "quiz-${list.id}") {
            QuizViewModel(container, QuizResultCache(appContext), list.id, context.uid)
        }
    val state by viewModel.state.collectAsStateWithLifecycle()

    ScreenColumn(title = "Quiz", onBack = null) {
        Text(
            "Uma pergunta por dia sobre os filmes de vocês. Cada acerto soma pontos no placar do mês.",
            style = MaterialTheme.typography.bodyMedium,
            color = LombadaColors.Paper2,
            modifier = Modifier.padding(horizontal = 20.dp)
        )
        // Quem respondeu as 10 não vê mais o card: elas passam para "Últimas perguntas".
        if (!state.event.progress.done) {
            EventSection(state.event) { id ->
                val type = state.event.items.firstOrNull { it.quiz.id == id }?.quiz?.type
                context.navigate(QuizPlayRoute(day = id, type = type))
            }
        }
        TodaySection(state, list, context.uid) { context.navigate(QuizPlayRoute(day = state.clock.day)) }
        SectionCard(
            title = "Placar de ${QuizScoreboard.monthName(state.clock.month)}",
            subtitle = "Quem fizer mais pontos no mês vence."
        ) {
            ScoreBoard(QuizScoreboard.rows(list.memberUids, state.scores, context.uid), list)
            LombadaButton(
                "Ver placar e detalhes da lista",
                onClick = { context.navigate(ListInfoRoute) },
                style = LombadaButtonStyle.Text,
                modifier = Modifier.padding(top = 8.dp)
            )
        }
        SectionCard(
            title = "Últimas perguntas",
            subtitle = "A resposta de cada pergunta aparece depois que você responde."
        ) {
            if (state.history.isEmpty()) {
                Text(
                    "As perguntas dos dias anteriores aparecem aqui, com o resultado de quem respondeu.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = LombadaColors.Paper2
                )
            }
            state.history.forEachIndexed { index, item ->
                if (index >
                    0
                ) {
                    HorizontalDivider(color = LombadaColors.Rule, modifier = Modifier.padding(vertical = 4.dp))
                }
                HistoryRow(item, list, context.uid) { context.navigate(QuizPlayRoute(day = item.quiz.id)) }
            }
        }
    }
}

@Composable
private fun TodaySection(state: QuizTabState, list: MovieList, uid: String, onPlay: () -> Unit) {
    val quiz = state.today
    if (state.loading) {
        SectionCard(title = "Pergunta de hoje") { LoadingBlock() }
        return
    }
    if (quiz == null) {
        SectionCard(title = "Pergunta de hoje") {
            if (state.clock.beforeRelease) {
                EmptyState(
                    "A pergunta de hoje sai às 5h30",
                    "Toda manhã, às 5h30 de Brasília, chega uma pergunta nova sobre os filmes da lista."
                )
            } else {
                EmptyState(
                    "A pergunta de hoje ainda não chegou",
                    "Ela sai às 5h30 de Brasília. Se demorar, abra de novo daqui a pouco."
                )
            }
        }
        return
    }
    val others = list.memberUids.filter { it != uid }
    SectionCard(
        title = "Pergunta de hoje",
        subtitle = listOfNotNull(QuizRules.typeTitle(quiz.type), dayLabel(quiz.day)).joinToString(" · ")
    ) {
        Text(quiz.prompt, style = MaterialTheme.typography.titleLarge.copy(fontSize = 20.sp, lineHeight = 26.sp))
        val mine = state.todayAnswers.mine
        if (mine == null) {
            LombadaButton("Responder", onClick = onPlay, modifier = Modifier.fillMaxWidth().padding(top = 14.dp))
            if (others.isNotEmpty()) {
                Text(
                    "O resultado de ${others.joinToString(" e ") {
                        memberName(list, it)
                    }} aparece depois que você responder.",
                    style = MaterialTheme.typography.bodySmall,
                    color = LombadaColors.Paper3,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
        } else {
            AnswersLine(state.todayAnswers, list, others, Modifier.padding(top = 12.dp))
            LombadaButton(
                "Ver a resposta",
                onClick = onPlay,
                style = LombadaButtonStyle.Tonal,
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp)
            )
        }
    }
}

/**
 * "Você acertou · Fulana errou", com quem ainda não respondeu.
 *
 * @param answers Respostas legíveis.
 * @param list Lista, para os nomes.
 * @param others Outros membros.
 * @param modifier Modificador do Compose.
 * @param pending O que dizer de quem não respondeu.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AnswersLine(
    answers: DayAnswers,
    list: MovieList,
    others: List<String>,
    modifier: Modifier = Modifier,
    pending: String = "ainda não respondeu"
) {
    val mine = answers.mine ?: return
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
        modifier = modifier.semantics(mergeDescendants = true) {}
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Você ", style = MaterialTheme.typography.bodyMedium)
            ResultMark(mine.correct)
        }
        others.forEach { other ->
            val answer = answers.others.firstOrNull { it.uid == other }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("· ${memberName(list, other)} ", style = MaterialTheme.typography.bodyMedium)
                if (answer == null) {
                    Text(pending, style = MaterialTheme.typography.bodyMedium, color = LombadaColors.Paper3)
                } else {
                    ResultMark(answer.correct)
                }
            }
        }
    }
}

@Composable
private fun HistoryRow(item: QuizHistoryItem, list: MovieList, uid: String, onOpen: () -> Unit) {
    val quiz = item.quiz
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(role = Role.Button, onClick = onOpen)
                .padding(vertical = 10.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                listOfNotNull(
                    if (quiz.event == null) dayLabel(quiz.day) else "Início de uso do app",
                    QuizRules.typeTitle(quiz.type)
                ).joinToString(" · "),
                style = MaterialTheme.typography.labelMedium,
                color = LombadaColors.Paper3,
                modifier = Modifier.weight(1f)
            )
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = LombadaColors.Paper3)
        }
        Text(quiz.prompt, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(top = 2.dp))
        if (item.answers.mine == null) {
            Text(
                "Você não respondeu esta.",
                style = MaterialTheme.typography.bodySmall,
                color = LombadaColors.Paper3,
                modifier = Modifier.padding(top = 4.dp)
            )
        } else {
            rightLabel(quiz, item.rightOptionId)?.let {
                Text(
                    "Resposta: $it",
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
            AnswersLine(
                item.answers,
                list,
                list.memberUids.filter { it != uid },
                Modifier.padding(top = 4.dp),
                pending = "não respondeu"
            )
        }
    }
}

private fun rightLabel(quiz: QuizDoc, rightOptionId: String?): String? =
    quiz.options.firstOrNull { it.id == rightOptionId }?.label

/**
 * Data por extenso de um dia `AAAA-MM-DD`, sem quebrar com um valor que não é data.
 *
 * @param day Dia.
 * @return A data por extenso, ou null se não der para ler.
 */
internal fun dayLabel(day: String): String? = runCatching { Formatting.fullDate(LocalDate.parse(day)) }.getOrNull()
