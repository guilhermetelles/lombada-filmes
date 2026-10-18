package io.github.guilhermetelles.lombada.ui.quiz

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.guilhermetelles.lombada.data.model.MovieList
import io.github.guilhermetelles.lombada.data.model.QuizDoc
import io.github.guilhermetelles.lombada.domain.BrazilDay
import io.github.guilhermetelles.lombada.domain.QuizEvent
import io.github.guilhermetelles.lombada.domain.QuizRules
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.components.LombadaButton
import io.github.guilhermetelles.lombada.ui.components.LombadaButtonStyle
import io.github.guilhermetelles.lombada.ui.components.MovieCover
import io.github.guilhermetelles.lombada.ui.feed.EmptyState
import io.github.guilhermetelles.lombada.ui.feed.LoadingBlock
import io.github.guilhermetelles.lombada.ui.feed.MemberAvatar
import io.github.guilhermetelles.lombada.ui.feed.ScreenColumn
import io.github.guilhermetelles.lombada.ui.feed.memberProfile
import io.github.guilhermetelles.lombada.ui.main.QuizPlayRoute
import io.github.guilhermetelles.lombada.ui.main.QuizRoute
import io.github.guilhermetelles.lombada.ui.main.ScreenContext
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/**
 * Pergunta do quiz de um dia ou do evento de início. Ponto de entrada do pacote, registrado no `MainScreen`.
 *
 * @param context Lista, pessoa logada e navegação.
 * @param route Argumentos da rota.
 */
@Composable
fun QuizPlayEntry(context: ScreenContext, route: QuizPlayRoute) {
    val container = appContainer()
    val appContext = LocalContext.current.applicationContext
    val list = context.list
    val day = route.day ?: BrazilDay.todayId()
    val viewModel =
        viewModel(key = "quiz-play-${list.id}-$day") {
            QuizPlayViewModel(container, QuizResultCache(appContext), list.id, context.uid, day)
        }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val title =
        when {
            state.isEvent -> state.eventIndex?.let { "Pergunta $it de ${QuizEvent.SIZE}" } ?: QuizEvent.TITLE
            state.isToday -> "Pergunta de hoje"
            else -> dayLabel(day)?.let { "Quiz de $it" } ?: "Quiz"
        }

    ScreenColumn(title = title, onBack = context.back) {
        val quiz = state.quiz
        when {
            state.loading -> LoadingBlock()

            quiz == null ->
                if (state.isEvent) {
                    EmptyState(
                        "Esta pergunta não está disponível",
                        "As perguntas do evento de início aparecem na aba Quiz quando ficam prontas."
                    )
                } else if (state.isToday) {
                    EmptyState(
                        if (QuizRules.beforeRelease()) {
                            "A pergunta de hoje sai às 5h30"
                        } else {
                            "A pergunta de hoje ainda não chegou"
                        },
                        "Toda manhã, às 5h30 de Brasília, chega uma pergunta nova sobre os filmes da lista."
                    )
                } else {
                    EmptyState(
                        "Não há pergunta neste dia",
                        "Só ficam guardadas as perguntas dos dias em que a rotina rodou."
                    )
                }

            else ->
                QuizBody(
                    state,
                    quiz,
                    list,
                    context.uid,
                    onAnswer = viewModel::answer,
                    onOpenQuiz = { context.navigate(QuizRoute) },
                    onNextEvent = { next ->
                        // Troca esta tela pela próxima: voltar leva à aba Quiz, não à pergunta anterior.
                        context.back()
                        context.navigate(QuizPlayRoute(day = next))
                    },
                    onDoneEvent = context.back
                )
        }
    }
}

@Composable
private fun QuizBody(
    state: QuizPlayState,
    quiz: QuizDoc,
    list: MovieList,
    uid: String,
    onAnswer: (String) -> Unit,
    onOpenQuiz: () -> Unit,
    onNextEvent: (String) -> Unit,
    onDoneEvent: () -> Unit
) {
    val mine = state.mine
    Column(modifier = Modifier.padding(horizontal = 20.dp)) {
        Text(
            if (state.isEvent) {
                "${QuizEvent.TITLE} · ${QuizRules.typeTitle(quiz.type)}"
            } else {
                QuizRules.typeTitle(quiz.type)
            },
            style = MaterialTheme.typography.labelLarge,
            color = LombadaColors.Sticker,
            modifier = Modifier.padding(top = 4.dp)
        )
        Text(
            quiz.prompt,
            style = MaterialTheme.typography.headlineSmall.copy(fontSize = 24.sp, lineHeight = 30.sp),
            modifier = Modifier.padding(top = 6.dp).semantics { heading() }
        )
        QuizMediaBlock(quiz, revealed = mine != null, modifier = Modifier.padding(top = 18.dp))
        Column(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 18.dp)) {
            quiz.options.forEach { option ->
                val look =
                    when {
                        mine == null -> OptionLook.Idle
                        option.id == mine.optionId && mine.correct -> OptionLook.MineRight
                        option.id == mine.optionId -> OptionLook.MineWrong
                        option.id == state.rightOptionId -> OptionLook.Right
                        else -> OptionLook.Idle
                    }
                QuizOptionButton(
                    label = option.label,
                    imageUrl = option.imageUrl,
                    look = look,
                    enabled = state.canAnswer,
                    sending = state.sendingOptionId == option.id,
                    onClick = { onAnswer(option.id) }
                )
            }
        }
        state.error?.let {
            Text(
                it,
                style = MaterialTheme.typography.bodyMedium,
                color = LombadaColors.Error,
                modifier = Modifier.padding(top = 10.dp)
            )
        }
        when {
            mine != null -> {
                ResultBlock(state, list, uid)
                if (state.isEvent) EventNextBlock(state.nextEventId, onNextEvent, onDoneEvent)
            }

            state.dayClosed || !state.open ->
                ClosedBlock(onOpenQuiz)
        }
    }
}

@Composable
private fun QuizMediaBlock(quiz: QuizDoc, revealed: Boolean, modifier: Modifier = Modifier) {
    val media = quiz.media ?: return
    val poster = media.posterPath
    when {
        poster != null && media.crop != null ->
            if (revealed) {
                FullPoster(poster, modifier.width(200.dp))
            } else {
                CroppedPoster(poster, media.crop, modifier.width(200.dp))
            }

        media.excerpt != null -> QuoteBlock(media.excerpt, modifier)

        media.emoji != null ->
            Text(
                media.emoji,
                style = MaterialTheme.typography.displaySmall.copy(fontSize = 44.sp, lineHeight = 56.sp),
                modifier = modifier.clearAndSetSemantics { contentDescription = "Enredo em emojis: ${media.emoji}" }
            )

        media.synopsis != null -> QuoteBlock(media.synopsis, modifier)

        // Diretor, ano, Bechdel: a capa ajuda a lembrar do filme.
        poster != null -> MovieCover(
            title = "",
            posterPath = poster,
            seed = poster.hashCode(),
            modifier = modifier.width(120.dp)
        )
    }
}

@Composable
private fun ResultBlock(state: QuizPlayState, list: MovieList, uid: String) {
    val mine = state.mine ?: return
    Column(
        modifier =
            Modifier
                .padding(top = 20.dp)
                .semantics { liveRegion = LiveRegionMode.Polite }
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.semantics(mergeDescendants = true) {}) {
            Icon(
                if (mine.correct) Icons.Filled.Check else Icons.Filled.Close,
                contentDescription = null,
                tint = if (mine.correct) LombadaColors.Sticker else LombadaColors.Error,
                modifier = Modifier.size(26.dp)
            )
            Text(
                if (mine.correct) "Acertou!" else "Errou. Fica para a próxima.",
                style = MaterialTheme.typography.titleLarge,
                color = if (mine.correct) LombadaColors.Sticker else LombadaColors.Error,
                modifier = Modifier.padding(start = 8.dp)
            )
        }
        when {
            state.explanation != null ->
                Text(
                    state.explanation,
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.padding(top = 8.dp)
                )

            state.rightOptionId == null ->
                Text(
                    "Você respondeu em outro aparelho: a resposta certa e a explicação ficaram lá.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = LombadaColors.Paper2,
                    modifier = Modifier.padding(top = 8.dp)
                )
        }
        OthersBlock(state, list, uid)
    }
}

@Composable
private fun OthersBlock(state: QuizPlayState, list: MovieList, uid: String) {
    val others = list.memberUids.filter { it != uid }
    // Lista com um membro só: sem "resultado do outro".
    if (others.isEmpty()) return
    val quiz = state.quiz ?: return
    Column(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 18.dp)) {
        others.forEach { other ->
            val profile = memberProfile(list, other)
            val answer = state.others.firstOrNull { it.uid == other }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.semantics(mergeDescendants = true) {
                }
            ) {
                MemberAvatar(profile.name, profile.photoUrl, 28.dp)
                if (answer == null) {
                    Text(
                        if (state.open) {
                            "${profile.name} ainda não respondeu. O resultado aparece aqui quando responder."
                        } else {
                            "${profile.name} não respondeu."
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        color = LombadaColors.Paper2,
                        modifier = Modifier.padding(start = 10.dp)
                    )
                } else {
                    val label = quiz.options.firstOrNull { it.id == answer.optionId }?.label
                    Text(
                        if (label != null) "${profile.name} respondeu “$label”: " else "${profile.name} ",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(start = 10.dp).weight(1f, fill = false)
                    )
                    ResultMark(answer.correct)
                }
            }
        }
    }
}

@Composable
private fun ClosedBlock(onOpenQuiz: () -> Unit) {
    Column(modifier = Modifier.padding(top = 20.dp)) {
        Text(
            "Esta pergunta fechou",
            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold)
        )
        Text(
            "Cada pergunta só aceita resposta no próprio dia, no horário de Brasília.",
            style = MaterialTheme.typography.bodyMedium,
            color = LombadaColors.Paper2,
            modifier = Modifier.padding(top = 4.dp)
        )
        LombadaButton(
            "Ver a pergunta de hoje",
            onClick = onOpenQuiz,
            style = LombadaButtonStyle.Tonal,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp)
        )
    }
}

@Composable
private fun EventNextBlock(nextId: String?, onNext: (String) -> Unit, onDone: () -> Unit) {
    if (nextId != null) {
        LombadaButton(
            "Próxima pergunta",
            onClick = { onNext(nextId) },
            modifier = Modifier.fillMaxWidth().padding(top = 20.dp)
        )
    } else {
        Text(
            "Você respondeu todas as perguntas do evento.",
            style = MaterialTheme.typography.bodyMedium,
            color = LombadaColors.Paper2,
            modifier = Modifier.padding(top = 20.dp)
        )
        LombadaButton(
            "Ver o placar",
            onClick = onDone,
            style = LombadaButtonStyle.Tonal,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp)
        )
    }
}
