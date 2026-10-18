package io.github.guilhermetelles.lombada.ui.listinfo

import android.content.ClipData
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.guilhermetelles.lombada.data.model.MovieList
import io.github.guilhermetelles.lombada.data.model.Scores
import io.github.guilhermetelles.lombada.domain.BrazilDay
import io.github.guilhermetelles.lombada.domain.Formatting
import io.github.guilhermetelles.lombada.domain.InviteCode
import io.github.guilhermetelles.lombada.domain.MemberRecord
import io.github.guilhermetelles.lombada.domain.MonthSummary
import io.github.guilhermetelles.lombada.domain.QuizScoreboard
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.components.LombadaButton
import io.github.guilhermetelles.lombada.ui.components.LombadaButtonStyle
import io.github.guilhermetelles.lombada.ui.feed.LoadingBlock
import io.github.guilhermetelles.lombada.ui.feed.MemberAvatar
import io.github.guilhermetelles.lombada.ui.feed.ScreenColumn
import io.github.guilhermetelles.lombada.ui.feed.SectionCard
import io.github.guilhermetelles.lombada.ui.feed.memberName
import io.github.guilhermetelles.lombada.ui.feed.memberProfile
import io.github.guilhermetelles.lombada.ui.main.ScreenContext
import io.github.guilhermetelles.lombada.ui.quiz.pointsLabel
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import java.time.ZoneId
import kotlinx.coroutines.launch

/**
 * Detalhes da lista: membros, placar, vencedores e convite. Ponto de entrada do pacote, registrado no `MainScreen`.
 *
 * @param context Lista, pessoa logada e navegação.
 */
@Composable
fun ListInfoEntry(context: ScreenContext) {
    val container = appContainer()
    val list = context.list
    val viewModel = viewModel(key = "list-info-${list.id}") { ListInfoViewModel(container, list.id) }
    val history by viewModel.history.collectAsStateWithLifecycle()
    val invite by viewModel.invite.collectAsStateWithLifecycle()
    val listState by context.listViewModel.state.collectAsStateWithLifecycle()
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()
    val month = BrazilDay.monthId()

    ScreenColumn(title = "Detalhes da lista", onBack = context.back) {
        Column(modifier = Modifier.padding(horizontal = 20.dp)) {
            Text(
                list.name,
                style = MaterialTheme.typography.headlineSmall.copy(fontSize = 26.sp),
                modifier = Modifier.semantics { heading() }
            )
            if (list.description.isNotBlank()) {
                Text(list.description, style = MaterialTheme.typography.bodyLarge, color = LombadaColors.Paper2)
            }
            if (!listState.loading) {
                Text(
                    "${Formatting.count(listState.ranking.size, "filme", "filmes")} no ranking",
                    style = MaterialTheme.typography.bodyMedium,
                    color = LombadaColors.Paper3,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
        val scores = history
        if (scores != null) {
            QuizScoreboard.lastMonthWinners(scores, month)?.let { WinnerNotice(it, list, context.uid) }
        }
        SectionCard(title = "Membros") {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                list.memberUids.forEach { uid -> MemberRow(list, uid, isMe = uid == context.uid) }
            }
        }
        SectionCard(
            title = "Placar do quiz",
            subtitle = "Quem fizer mais pontos no mês vence. Empate, os dois vencem."
        ) {
            if (scores == null) {
                LoadingBlock()
            } else {
                RecordsTable(QuizScoreboard.records(list.memberUids, scores, month, context.uid), list)
            }
        }
        SectionCard(title = "Últimos 6 meses") {
            val months = scores?.let { QuizScoreboard.recentMonths(list.memberUids, it, month) }
            when {
                months == null -> LoadingBlock()

                months.isEmpty() ->
                    Text(
                        "O placar de cada mês aparece aqui depois da primeira resposta do quiz.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = LombadaColors.Paper2
                    )

                else ->
                    months.forEachIndexed { index, summary ->
                        if (index > 0) HorizontalDivider(color = LombadaColors.Rule)
                        MonthRow(summary, list)
                    }
            }
        }
        SectionCard(
            title = "Convidar",
            subtitle = "Mande o código para quem vai entrar na lista. Vale por 7 dias, para quantas pessoas entrarem."
        ) {
            val shown = invite.invite
            if (shown == null) {
                LombadaButton(
                    "Gerar código",
                    onClick = viewModel::generateInvite,
                    style = LombadaButtonStyle.Tonal,
                    busy = invite.generating
                )
            } else {
                val formatted = InviteCode.format(shown.code)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        formatted,
                        style = MaterialTheme.typography.headlineMedium.copy(
                            fontWeight = FontWeight.ExtraBold,
                            letterSpacing = 3.sp
                        ),
                        color = LombadaColors.Sticker,
                        modifier =
                            Modifier
                                .weight(1f)
                                .clearAndSetSemantics {
                                    contentDescription =
                                        "Código ${formatted.toList().joinToString(" ")}"
                                }
                    )
                    LombadaButton(
                        "Copiar",
                        onClick = {
                            scope.launch {
                                clipboard.setClipEntry(ClipEntry(ClipData.newPlainText("Código da lista", formatted)))
                                container.snackbar.showSnackbar("Código copiado")
                            }
                        },
                        style = LombadaButtonStyle.Tonal
                    )
                }
                shown.expiresAt?.let {
                    Text(
                        "Vale até ${Formatting.fullDate(it.atZone(ZoneId.systemDefault()).toLocalDate())}.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LombadaColors.Paper3,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun WinnerNotice(scores: Scores, list: MovieList, me: String) {
    val names = scores.winnerUids.map { if (it == me) "${memberName(list, it)} (você)" else memberName(list, it) }
    val points = scores.winnerUids.firstNotNullOfOrNull { scores.points[it] } ?: 0
    val monthLabel = QuizScoreboard.monthLabel(scores.month)
    val text =
        if (names.size == 1) {
            "${names.first()} venceu o quiz de $monthLabel com ${pointsLabel(points)}."
        } else {
            "${names.joinToString(" e ")} empataram no quiz de $monthLabel, com ${pointsLabel(points)}."
        }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier =
            Modifier
                .padding(start = 16.dp, end = 16.dp, top = 14.dp)
                .fillMaxWidth()
                .background(LombadaColors.Sticker.copy(alpha = 0.14f), MaterialTheme.shapes.large)
                .padding(16.dp)
                .semantics(mergeDescendants = true) {}
    ) {
        Icon(Icons.Filled.EmojiEvents, contentDescription = null, tint = LombadaColors.Sticker)
        Text(text, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(start = 12.dp))
    }
}

@Composable
private fun MemberRow(list: MovieList, uid: String, isMe: Boolean) {
    val profile = memberProfile(list, uid)
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.semantics(mergeDescendants = true) {}) {
        MemberAvatar(profile.name, profile.photoUrl, 40.dp)
        Column(modifier = Modifier.padding(start = 12.dp)) {
            Text(profile.name, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.SemiBold))
            val tags = listOfNotNull("você".takeIf { isMe }, "criou a lista".takeIf { uid == list.ownerUid })
            if (tags.isNotEmpty()) {
                Text(tags.joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = LombadaColors.Paper3)
            }
        }
    }
}

@Composable
private fun RecordsTable(records: List<MemberRecord>, list: MovieList) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(modifier = Modifier.clearAndSetSemantics {}) {
            Text("", modifier = Modifier.weight(1f))
            listOf("No mês", "Meses vencidos", "Total").forEach { HeaderCell(it) }
        }
        records.forEach { record ->
            val name = memberName(list, record.uid) + if (record.isMe) " (você)" else ""
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier =
                    Modifier.clearAndSetSemantics {
                        contentDescription =
                            "$name: ${pointsLabel(record.monthPoints)} no mês, " +
                            "${Formatting.count(
                                record.monthsWon,
                                "mês vencido",
                                "meses vencidos"
                            )}, ${pointsLabel(record.total)} no total"
                    }
            ) {
                val profile = memberProfile(list, record.uid)
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                    MemberAvatar(profile.name, profile.photoUrl, 24.dp)
                    Text(
                        name,
                        style = MaterialTheme.typography.bodyMedium,
                        maxLines = 1,
                        modifier = Modifier.padding(start = 8.dp)
                    )
                }
                listOf(record.monthPoints, record.monthsWon, record.total).forEach { NumberCell(it) }
            }
        }
    }
}

@Composable
private fun HeaderCell(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.labelSmall,
        color = LombadaColors.Paper3,
        textAlign = TextAlign.End,
        modifier = Modifier.width(64.dp)
    )
}

@Composable
private fun NumberCell(value: Int) {
    Text(
        value.toString(),
        style = MaterialTheme.typography.titleMedium,
        textAlign = TextAlign.End,
        modifier = Modifier.width(64.dp)
    )
}

@Composable
private fun MonthRow(summary: MonthSummary, list: MovieList) {
    Column(modifier = Modifier.padding(vertical = 10.dp).semantics(mergeDescendants = true) {}) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                QuizScoreboard.monthLabel(summary.month).replaceFirstChar { it.uppercase() },
                style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.SemiBold),
                modifier = Modifier.weight(1f)
            )
            when {
                summary.current -> Text(
                    "em andamento",
                    style = MaterialTheme.typography.bodySmall,
                    color = LombadaColors.Paper3
                )

                summary.winnerUids.isEmpty() ->
                    Text("sem vencedor ainda", style = MaterialTheme.typography.bodySmall, color = LombadaColors.Paper3)

                summary.winnerUids.size > 1 -> Text(
                    "empate",
                    style = MaterialTheme.typography.bodyMedium,
                    color = LombadaColors.Sticker
                )

                else -> {
                    val winner = memberProfile(list, summary.winnerUids.first())
                    Icon(
                        Icons.Filled.EmojiEvents,
                        contentDescription = null,
                        tint = LombadaColors.Sticker,
                        modifier = Modifier.size(18.dp)
                    )
                    Text(
                        "${winner.name} venceu",
                        style = MaterialTheme.typography.bodyMedium,
                        color = LombadaColors.Sticker,
                        modifier = Modifier.padding(start = 4.dp)
                    )
                }
            }
        }
        Text(
            summary.points.joinToString(" · ") { (uid, points) -> "${memberName(list, uid)} $points" },
            style = MaterialTheme.typography.bodyMedium,
            color = LombadaColors.Paper2,
            modifier = Modifier.padding(top = 2.dp)
        )
    }
}
