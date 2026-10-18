package io.github.guilhermetelles.lombada.ui.reports

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.github.guilhermetelles.lombada.data.model.SourceUsage
import io.github.guilhermetelles.lombada.data.model.UsageDay
import io.github.guilhermetelles.lombada.domain.Formatting
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import java.time.LocalDate
import java.time.ZoneId
import kotlinx.coroutines.flow.catch

/** Fontes na ordem da tela, com o nome, para que servem e o limite documentado. */
private val SOURCES =
    listOf(
        Triple(
            "tmdb",
            "TMDb",
            "Catálogo, elenco, fichas e busca. Sem cota diária; limite de cerca de 50 pedidos por segundo."
        ),
        Triple(
            "letterboxd",
            "Letterboxd",
            "Nota e página de cada filme, pelas páginas públicas. Sem cota documentada."
        ),
        Triple(
            "omdb",
            "OMDb",
            "Notas do IMDb, Rotten Tomatoes e Metacritic, prêmios e bilheteria nos EUA. Cota diária do plano gratuito."
        ),
        Triple("bechdel", "Bechdel Test", "Teste de Bechdel: índice e páginas do site. Sem cota documentada."),
        Triple(
            "wikidata",
            "Wikidata",
            "Prêmios e indicações de filmes e pessoas, numa consulta por lote na rotina diária. " +
                "Sem cota documentada."
        ),
        Triple(
            "wikipedia",
            "Wikipedia",
            "Indicações e vitórias na Framboesa de Ouro, pelas categorias da Wikipedia. Sem cota documentada."
        ),
        Triple(
            "gemini",
            "Gemini",
            "Motivos das sugestões, textos do quiz, retrospectiva do mês e busca em texto livre. " +
                "Plano gratuito, com limite diário: aqui aparece só o uso."
        )
    )

/**
 * Consumo das APIs, lendo `usage/`: um card por fonte com o dia de hoje, o medidor da cota da OMDb
 * e as colunas de pedidos por dia.
 *
 * @param onBack Volta para os relatórios.
 */
@Composable
fun UsageScreen(onBack: () -> Unit) {
    val container = appContainer()
    var failed by remember { mutableStateOf(false) }
    val flow = remember { container.usage.observeRecent().catch { failed = true } }
    val days by flow.collectAsStateWithLifecycle(initialValue = null)
    val today = LocalDate.now(ZoneId.of("America/Sao_Paulo"))

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(LombadaColors.Ground)
                .statusBarsPadding()
                .verticalScroll(rememberScrollState())
                .navigationBarsPadding()
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.height(56.dp).padding(horizontal = 4.dp)
        ) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar") }
            Text(
                "Consumo das APIs",
                style = MaterialTheme.typography.titleLarge.copy(fontSize = 18.sp),
                modifier = Modifier.padding(start = 4.dp)
            )
        }
        val list = days
        Text(
            "Nenhuma dessas APIs informa o consumo nas respostas: o backend conta cada pedido e grava " +
                "por dia, no fuso de São Paulo. Os números de hoje são de ${Formatting.fullDate(today)}.",
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp, lineHeight = 19.sp),
            color = LombadaColors.Paper3,
            modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 6.dp)
        )
        if (failed) {
            Text(
                "Não deu para ler o consumo agora.",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(20.dp)
            )
            return@Column
        }
        if (list == null) return@Column
        if (list.isEmpty()) {
            Text(
                "Nenhum registro ainda.",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(20.dp)
            )
            return@Column
        }
        val todayUsage = list.firstOrNull { it.day == today }
        SOURCES.forEach { (key, name, use) ->
            SourceCard(
                name,
                use,
                todayUsage?.sources?.get(key) ?: SourceUsage(0, 0, 0, null)
            )
        }
        DailyColumns(list)
        Box(Modifier.height(24.dp))
    }
}

@Composable
private fun SourceCard(name: String, use: String, usage: SourceUsage) {
    Column(
        modifier =
            Modifier
                .padding(start = 16.dp, end = 16.dp, top = 12.dp)
                .fillMaxWidth()
                .background(LombadaColors.Shelf, MaterialTheme.shapes.large)
                .padding(horizontal = 16.dp, vertical = 14.dp)
    ) {
        Text(name, style = MaterialTheme.typography.titleMedium, modifier = Modifier.semantics { heading() })
        Text(
            use,
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp),
            color = LombadaColors.Paper2,
            modifier = Modifier.padding(top = 2.dp)
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 12.dp)) {
            Counter(usage.calls, "pedidos hoje", false, Modifier.weight(1f))
            Counter(usage.cacheHits, "vindos do cache", false, Modifier.weight(1f))
            Counter(usage.errors, "erros", usage.errors > 0, Modifier.weight(1f))
        }
        usage.dailyLimit?.let { limit ->
            val fraction = (usage.calls.toFloat() / limit).coerceIn(0f, 1f)
            val hot = fraction > 0.9f
            Box(
                Modifier
                    .padding(top = 12.dp)
                    .fillMaxWidth()
                    .height(8.dp)
                    .background(LombadaColors.Ground, RoundedCornerShape(4.dp))
                    .clearAndSetSemantics { contentDescription = "Cota diária: ${usage.calls} de $limit pedidos" }
            ) {
                Box(
                    Modifier
                        .fillMaxWidth(fraction)
                        .widthIn(min = 4.dp)
                        .fillMaxHeight()
                        .background(
                            if (hot) LombadaColors.Error else LombadaColors.Sticker,
                            RoundedCornerShape(topEnd = 4.dp, bottomEnd = 4.dp)
                        )
                )
            }
            Text(
                buildAnnotatedString {
                    withStyle(SpanStyle(color = LombadaColors.Paper, fontWeight = FontWeight.SemiBold)) {
                        append("${usage.calls}")
                    }
                    append(" de $limit pedidos da cota de hoje.")
                },
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.5.sp),
                color = LombadaColors.Paper3,
                modifier = Modifier.padding(top = 8.dp)
            )
        }
    }
}

@Composable
private fun Counter(value: Int, label: String, bad: Boolean, modifier: Modifier = Modifier) {
    Column(modifier = modifier.semantics(mergeDescendants = true) {}) {
        Text(
            value.toString(),
            style = MaterialTheme.typography.titleLarge,
            color = if (bad) LombadaColors.Error else LombadaColors.Paper
        )
        Text(label, style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp), color = LombadaColors.Paper2)
    }
}

@Composable
private fun DailyColumns(days: List<UsageDay>) {
    val max = days.maxOfOrNull { it.totalCalls }?.coerceAtLeast(1) ?: 1
    Column(
        modifier =
            Modifier
                .padding(start = 16.dp, end = 16.dp, top = 12.dp)
                .fillMaxWidth()
                .background(LombadaColors.Shelf, MaterialTheme.shapes.large)
                .padding(horizontal = 16.dp, vertical = 14.dp)
    ) {
        Text(
            "Pedidos por dia",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(bottom = 10.dp).semantics {
                heading()
            }
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(3.dp),
            verticalAlignment = Alignment.Bottom,
            modifier = Modifier.fillMaxWidth().height(112.dp)
        ) {
            days.forEach { day ->
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Bottom,
                    modifier =
                        Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .clearAndSetSemantics {
                                contentDescription =
                                    "${Formatting.shortDate(day.day)}: ${day.totalCalls} pedidos"
                            }
                ) {
                    if (days.size <=
                        14
                    ) {
                        Text(
                            day.totalCalls.toString(),
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        )
                    }
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .widthIn(max = 18.dp)
                            .fillMaxHeight(0.8f * day.totalCalls / max)
                            .background(LombadaColors.Sticker, RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                    )
                }
            }
        }
        HorizontalDivider(color = LombadaColors.Rule)
        Row(modifier = Modifier.fillMaxWidth().padding(top = 4.dp)) {
            Text(
                Formatting.shortDate(days.first().day),
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                color = LombadaColors.Paper3,
                modifier = Modifier.weight(1f)
            )
            Text(
                Formatting.shortDate(days.last().day),
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                color = LombadaColors.Paper3,
                textAlign = TextAlign.End
            )
        }
    }
}
