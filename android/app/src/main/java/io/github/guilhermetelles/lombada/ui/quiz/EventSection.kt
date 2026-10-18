package io.github.guilhermetelles.lombada.ui.quiz

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import io.github.guilhermetelles.lombada.domain.QuizEvent
import io.github.guilhermetelles.lombada.domain.QuizRules
import io.github.guilhermetelles.lombada.ui.components.LombadaButton
import io.github.guilhermetelles.lombada.ui.components.LombadaButtonStyle
import io.github.guilhermetelles.lombada.ui.feed.SectionCard
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/**
 * Card do evento de início no topo da aba Quiz: progresso, botão para a próxima pergunta não
 * respondida e a lista das 10. Some enquanto o backend não gravou as perguntas.
 *
 * @param event Perguntas do evento e as próprias respostas.
 * @param onOpen Abre a pergunta de um id (`inicio-NN`).
 */
@Composable
fun EventSection(event: QuizEventState, onOpen: (String) -> Unit) {
    if (event.items.isEmpty()) return
    val progress = event.progress
    var showList by rememberSaveable { mutableStateOf(false) }
    SectionCard(
        title = QuizEvent.TITLE,
        subtitle = "${progress.total} perguntas valendo pontos no placar do mês. Responda quando quiser."
    ) {
        if (progress.done) {
            Text(
                "Evento concluído: ${progress.correct} de ${progress.total} acertos",
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                color = LombadaColors.Sticker,
                modifier = Modifier.padding(top = 10.dp)
            )
            LombadaButton(
                if (showList) "Esconder as perguntas" else "Ver as perguntas",
                onClick = { showList = !showList },
                style = LombadaButtonStyle.Text,
                modifier = Modifier.padding(top = 4.dp)
            )
            if (showList) EventList(event, onOpen)
            return@SectionCard
        }
        Text(
            "${progress.answered} de ${progress.total} respondidas",
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
            modifier = Modifier.padding(top = 10.dp)
        )
        ProgressBar(progress.answered, progress.total, Modifier.padding(top = 6.dp))
        event.nextUnanswered()?.let { next ->
            LombadaButton(
                if (progress.answered == 0) "Responder" else "Continuar",
                onClick = { onOpen(next) },
                modifier = Modifier.fillMaxWidth().padding(top = 14.dp)
            )
        }
        EventList(event, onOpen, Modifier.padding(top = 8.dp))
    }
}

@Composable
private fun ProgressBar(done: Int, total: Int, modifier: Modifier = Modifier) {
    val fraction = if (total == 0) 0f else (done.toFloat() / total).coerceIn(0f, 1f)
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp))
                .background(LombadaColors.Rule)
                .clearAndSetSemantics { contentDescription = "$done de $total respondidas" }
    ) {
        Box(modifier = Modifier.fillMaxWidth(fraction).fillMaxHeight().background(LombadaColors.Sticker))
    }
}

@Composable
private fun EventList(event: QuizEventState, onOpen: (String) -> Unit, modifier: Modifier = Modifier) {
    Column(modifier = modifier) {
        event.items.forEachIndexed { position, item ->
            if (position > 0) HorizontalDivider(color = LombadaColors.Rule)
            val number = item.quiz.eventIndex ?: QuizEvent.indexOf(item.quiz.id) ?: (position + 1)
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clickable(role = Role.Button) { onOpen(item.quiz.id) }
                        .padding(vertical = 10.dp)
            ) {
                Text(
                    "$number",
                    style = MaterialTheme.typography.labelLarge,
                    color = LombadaColors.Paper3,
                    modifier = Modifier.width(28.dp)
                )
                Text(
                    QuizRules.typeTitle(item.quiz.type),
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.weight(1f)
                )
                val mine = item.mine
                if (mine == null) {
                    Text("pendente", style = MaterialTheme.typography.bodyMedium, color = LombadaColors.Paper3)
                } else {
                    ResultMark(mine.correct)
                }
                Icon(
                    Icons.AutoMirrored.Filled.KeyboardArrowRight,
                    contentDescription = null,
                    tint = LombadaColors.Paper3
                )
            }
        }
    }
}
