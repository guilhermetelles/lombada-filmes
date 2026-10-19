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
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/** Explicação fixa do limite do Gemini, que vale mesmo quando `/api/status` não responde. */
const val GEMINI_LIMIT_TEXT =
    "O plano grátis do Gemini tem limite baixo: cerca de 20 pedidos por dia para cada modelo Flash. " +
        "Quando a cota de um modelo acaba, o backend passa para o seguinte da ordem."

/**
 * Ordem dos modelos do Gemini e o consumo de hoje de cada um.
 *
 * @param gemini Ordem dos modelos, ou null quando o backend não mandou.
 * @param lines Modelos com o consumo de hoje, na ordem em que o backend tenta.
 */
@Composable
fun GeminiModels(gemini: GeminiInfo?, lines: List<GeminiModelLine>) {
    Column {
        OrderLine("Busca em texto livre", gemini?.interpret.orEmpty())
        OrderLine("Motivos, quiz e retrospectiva", gemini?.text.orEmpty())
        if (lines.isEmpty()) {
            Text(
                "O consumo por modelo aparece aqui depois do primeiro pedido do dia.",
                style = MaterialTheme.typography.bodySmall,
                color = LombadaColors.Paper3,
                modifier = Modifier.padding(top = 8.dp)
            )
        } else {
            Text(
                "Hoje",
                style = MaterialTheme.typography.labelMedium,
                color = LombadaColors.Paper3,
                modifier = Modifier.padding(top = 12.dp, bottom = 4.dp)
            )
            lines.forEach { ModelRow(it) }
        }
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
    // `quota` conta as respostas 429 do dia: o modelo ficou sem cota e o backend passou para o próximo.
    val outOfQuota = (line.quota ?: 0) > 0
    val otherErrors = line.errors - (line.quota ?: 0)
    val calls = if (line.calls == 1) "1 pedido" else "${line.calls} pedidos"
    val tail =
        when {
            outOfQuota -> " · sem cota hoje"
            otherErrors == 1 -> " · 1 erro"
            otherErrors > 1 -> " · $otherErrors erros"
            else -> ""
        }
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp).semantics(mergeDescendants = true) {}) {
        Text(
            line.model,
            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
            modifier = Modifier.weight(1f).padding(end = 8.dp)
        )
        Text(
            "$calls$tail",
            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
            color = if (tail.isNotEmpty()) LombadaColors.Error else LombadaColors.Paper2,
            textAlign = TextAlign.End
        )
    }
}
