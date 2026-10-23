package io.github.guilhermetelles.lombada.ui.status

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.guilhermetelles.lombada.data.model.GeminiInfo
import io.github.guilhermetelles.lombada.domain.GeminiModelLine
import io.github.guilhermetelles.lombada.domain.GeminiPurposeLine
import io.github.guilhermetelles.lombada.domain.GeminiRestingLine
import io.github.guilhermetelles.lombada.domain.StatusLines
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/** Explicação fixa do limite do Gemini, que vale mesmo quando `/api/status` não responde. */
const val GEMINI_LIMIT_TEXT =
    "O plano grátis do Gemini tem limite baixo: cerca de 20 pedidos por dia para cada modelo Flash. " +
        "Quando a cota de um modelo acaba ou ele sai do ar, o backend passa para o seguinte da ordem."

/**
 * Ordem dos modelos do Gemini, o resultado de hoje de cada uso, os modelos pulados agora e o
 * consumo de hoje de cada modelo.
 *
 * @param gemini Ordem dos modelos, ou null quando o backend não mandou.
 * @param lines Modelos com o consumo de hoje, na ordem em que o backend tenta.
 * @param purposes Usos com pedidos hoje (busca, sugestões, quiz, retrospectiva).
 * @param resting Modelos pulados agora, com o motivo e até quando.
 */
@Composable
fun GeminiModels(
    gemini: GeminiInfo?,
    lines: List<GeminiModelLine>,
    purposes: List<GeminiPurposeLine> = emptyList(),
    resting: List<GeminiRestingLine> = emptyList()
) {
    Column {
        OrderLine("Busca em texto livre", gemini?.interpret.orEmpty())
        OrderLine("Motivos, quiz e retrospectiva", gemini?.text.orEmpty())
        if (purposes.isNotEmpty()) {
            SubHeading("Pedidos de hoje")
            purposes.forEach { PurposeRow(it) }
        }
        if (resting.isNotEmpty()) {
            SubHeading("Pulados agora")
            resting.forEach { ValueRow(it.model, it.label, highlight = true) }
        }
        if (lines.none { it.calls > 0 }) {
            Text(
                "O consumo por modelo aparece aqui depois do primeiro pedido do dia.",
                style = MaterialTheme.typography.bodySmall,
                color = LombadaColors.Paper3,
                modifier = Modifier.padding(top = 8.dp)
            )
        } else {
            SubHeading("Modelos hoje")
            lines.forEach { ModelRow(it) }
        }
    }
}

@Composable
private fun SubHeading(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.labelMedium,
        color = LombadaColors.Paper3,
        modifier = Modifier.padding(top = 12.dp, bottom = 4.dp)
    )
}

@Composable
private fun PurposeRow(line: GeminiPurposeLine) {
    ValueRow(line.label, StatusLines.geminiPurposeLabel(line), highlight = line.failed > 0)
}

@Composable
private fun ValueRow(label: String, value: String, highlight: Boolean) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp).semantics(mergeDescendants = true) {}) {
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
            modifier = Modifier.weight(1f).padding(end = 8.dp)
        )
        Text(
            value,
            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
            color = if (highlight) LombadaColors.Error else LombadaColors.Paper2,
            textAlign = TextAlign.End
        )
    }
}

@Composable
private fun OrderLine(label: String, models: List<String>) {
    if (models.isEmpty()) return
    Column(modifier = Modifier.padding(top = 4.dp).semantics(mergeDescendants = true) {}) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = LombadaColors.Paper3)
        Text(
            models.joinToString(" → "),
            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
            color = LombadaColors.Paper
        )
    }
}

@Composable
private fun ModelRow(line: GeminiModelLine) {
    val detail = StatusLines.geminiModelDetail(line)
    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp).semantics(mergeDescendants = true) {}) {
        Row(modifier = Modifier.fillMaxWidth()) {
            Text(
                line.model,
                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
                modifier = Modifier.weight(1f).padding(end = 8.dp)
            )
            Text(
                StatusLines.geminiModelSummary(line),
                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
                color = if (line.errors > 0) LombadaColors.Error else LombadaColors.Paper2,
                textAlign = TextAlign.End
            )
        }
        if (detail.isNotEmpty()) {
            Text(
                detail,
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp),
                color = LombadaColors.Paper3,
                textAlign = TextAlign.End,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}
