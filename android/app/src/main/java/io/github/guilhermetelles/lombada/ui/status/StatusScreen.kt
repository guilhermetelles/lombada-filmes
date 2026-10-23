package io.github.guilhermetelles.lombada.ui.status

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.guilhermetelles.lombada.data.model.AppStatus
import io.github.guilhermetelles.lombada.data.model.JobStatus
import io.github.guilhermetelles.lombada.domain.BrazilDay
import io.github.guilhermetelles.lombada.domain.JobHealth
import io.github.guilhermetelles.lombada.domain.StatusLines
import io.github.guilhermetelles.lombada.domain.UsageTable
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.feed.EmptyState
import io.github.guilhermetelles.lombada.ui.feed.LoadingBlock
import io.github.guilhermetelles.lombada.ui.feed.ScreenColumn
import io.github.guilhermetelles.lombada.ui.feed.SectionCard
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import java.time.Instant
import java.time.format.DateTimeFormatter

private val dayHeader = DateTimeFormatter.ofPattern("dd/MM")

/**
 * Status do app: as rotinas do servidor, o consumo dos últimos 7 dias por fonte e os modelos do
 * Gemini, lidos de `GET /api/status`.
 *
 * @param onBack Volta para o consumo.
 */
@Composable
fun StatusScreen(onBack: () -> Unit) {
    val container = appContainer()
    val viewModel = viewModel(key = "status") { StatusViewModel(container) }
    val state by viewModel.state.collectAsStateWithLifecycle()

    ScreenColumn(title = "Status do app", onBack = onBack) {
        when (val current = state) {
            StatusState.Loading -> LoadingBlock()

            is StatusState.Failed ->
                EmptyState(
                    "Não deu para ler o status",
                    if (current.offline) {
                        "Sem conexão com o servidor. Confira a internet."
                    } else {
                        "O servidor não respondeu agora."
                    },
                    actionLabel = "Tentar de novo",
                    onAction = viewModel::load
                )

            is StatusState.Loaded -> Loaded(current.status)
        }
    }
}

@Composable
private fun Loaded(status: AppStatus) {
    val now = remember(status) { Instant.now() }
    SectionCard(
        title = "Rotinas",
        subtitle = "Rodam sozinhas no servidor, todo dia. Horários de Brasília."
    ) {
        if (status.jobs.isEmpty()) {
            Text(
                "Nenhuma rotina registrou execução ainda. Cada uma aparece aqui depois da primeira vez que rodar.",
                style = MaterialTheme.typography.bodyMedium,
                color = LombadaColors.Paper2
            )
        }
        status.jobs.forEachIndexed { index, job ->
            if (index > 0) HorizontalDivider(color = LombadaColors.Rule, modifier = Modifier.padding(vertical = 10.dp))
            JobRow(job, now)
        }
    }
    val table = remember(status) { StatusLines.usageTable(status.usage) }
    SectionCard(
        title = "Consumo dos últimos 7 dias",
        subtitle = "Pedidos de cada fonte por dia; os erros aparecem em vermelho, embaixo."
    ) {
        if (table.rows.isEmpty()) {
            Text(
                "Nenhum pedido registrado nos últimos 7 dias.",
                style = MaterialTheme.typography.bodyMedium,
                color = LombadaColors.Paper2
            )
        } else {
            UsageGrid(table)
        }
    }
    val lines = remember(status) { StatusLines.geminiToday(status.gemini, status.usage, BrazilDay.today()) }
    val purposes = remember(status) { StatusLines.geminiPurposesToday(status.usage, BrazilDay.today()) }
    val resting = remember(status, now) { StatusLines.geminiResting(status.gemini, now) }
    SectionCard(title = "Gemini", subtitle = GEMINI_LIMIT_TEXT) {
        GeminiModels(status.gemini, lines, purposes, resting)
    }
}

@Composable
private fun JobRow(job: JobStatus, now: Instant) {
    val health = JobHealth.fromWire(job.status)
    val (icon, color) = healthLook(health)
    Row(
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxWidth().semantics(mergeDescendants = true) {}
    ) {
        Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(22.dp).padding(top = 2.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(StatusLines.jobName(job.name), style = MaterialTheme.typography.titleSmall)
            val runs =
                listOfNotNull(StatusLines.lastRunLabel(job.lastRunAt, now), StatusLines.durationLabel(job.durationMs))
            Text(
                "${health.label} · ${runs.joinToString(" · ")}",
                style = MaterialTheme.typography.bodySmall,
                color = color
            )
            job.summary?.takeIf { it.isNotBlank() }?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp, lineHeight = 20.sp),
                    color = LombadaColors.Paper2,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
            job.warnings.filter { it.isNotBlank() }.forEach { warning ->
                Text(
                    "• $warning",
                    style = MaterialTheme.typography.bodySmall.copy(lineHeight = 18.sp),
                    color = LombadaColors.Paper3,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
        }
    }
}

private fun healthLook(health: JobHealth): Pair<ImageVector, Color> = when (health) {
    JobHealth.Ok -> Icons.Filled.CheckCircle to LombadaColors.Sticker
    JobHealth.Partial -> Icons.Filled.Warning to LombadaColors.PosterOrange
    JobHealth.Failed -> Icons.Filled.Error to LombadaColors.Error
    JobHealth.Unknown -> Icons.Filled.Info to LombadaColors.Paper3
}

// Tabela com rolagem lateral: nome da fonte e uma coluna por dia, com o total no fim.
@Composable
private fun UsageGrid(table: UsageTable) {
    val nameWidth = 92.dp
    val cellWidth = 44.dp
    Row(modifier = Modifier.horizontalScroll(rememberScrollState())) {
        Column {
            Row {
                Text("", modifier = Modifier.width(nameWidth))
                table.days.forEach { day ->
                    HeaderCell(day.format(dayHeader), cellWidth)
                }
                HeaderCell("Total", cellWidth + 8.dp)
            }
            table.rows.forEach { row ->
                val rowWidth = nameWidth + cellWidth * (table.days.size + 1) + 8.dp
                HorizontalDivider(color = LombadaColors.Rule, modifier = Modifier.width(rowWidth))
                Row(verticalAlignment = Alignment.Top, modifier = Modifier.padding(vertical = 6.dp)) {
                    Text(row.name, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.width(nameWidth))
                    row.calls.indices.forEach { i -> CountCell(row.calls[i], row.errors[i], cellWidth) }
                    CountCell(row.totalCalls, row.totalErrors, cellWidth + 8.dp, strong = true)
                }
            }
        }
    }
}

@Composable
private fun HeaderCell(text: String, width: Dp) {
    Text(
        text,
        style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp),
        color = LombadaColors.Paper3,
        textAlign = TextAlign.End,
        modifier = Modifier.width(width).padding(bottom = 4.dp)
    )
}

@Composable
private fun CountCell(calls: Int, errors: Int, width: Dp, strong: Boolean = false) {
    Column(horizontalAlignment = Alignment.End, modifier = Modifier.width(width)) {
        Text(
            calls.toString(),
            style =
                MaterialTheme.typography.bodyMedium.copy(
                    fontSize = 14.sp,
                    fontWeight = if (strong) FontWeight.SemiBold else FontWeight.Normal
                ),
            color = if (calls == 0) LombadaColors.Paper3 else LombadaColors.Paper
        )
        if (errors > 0) {
            Text(errors.toString(), style = MaterialTheme.typography.labelSmall, color = LombadaColors.Error)
        }
    }
}
