package io.github.guilhermetelles.lombada.ui.reports

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.guilhermetelles.lombada.domain.Bar
import io.github.guilhermetelles.lombada.domain.Calendar
import io.github.guilhermetelles.lombada.domain.CriticRow
import io.github.guilhermetelles.lombada.domain.Formatting
import io.github.guilhermetelles.lombada.domain.Reports
import io.github.guilhermetelles.lombada.ui.detail.PersonCircle
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/**
 * Seção dos relatórios, em `--shelf` com raio 16.
 *
 * @param title Título.
 * @param subtitle Linha explicativa.
 * @param modifier Modificador do Compose.
 * @param onClick Torna a seção inteira clicável.
 * @param content Conteúdo.
 */
@Composable
fun ReportSection(
    title: String,
    subtitle: AnnotatedString?,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    content: @Composable () -> Unit
) {
    Column(
        modifier =
            modifier
                .padding(start = 16.dp, end = 16.dp, top = 14.dp)
                .fillMaxWidth()
                .background(LombadaColors.Shelf, MaterialTheme.shapes.large)
                .then(if (onClick != null) Modifier.clickable(role = Role.Button, onClick = onClick) else Modifier)
                .padding(16.dp)
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.semantics { heading() })
        if (subtitle != null) {
            Text(
                subtitle,
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp, lineHeight = 18.sp),
                color = LombadaColors.Paper3,
                modifier = Modifier.padding(top = 3.dp, bottom = 14.dp)
            )
        }
        content()
    }
}

/**
 * Bloco de número grande e rótulo.
 *
 * @param value Número.
 * @param unit Unidade ao lado (`/10`).
 * @param label Rótulo.
 * @param modifier Modificador do Compose.
 */
@Composable
fun StatTile(value: String, unit: String?, label: String, modifier: Modifier = Modifier) {
    Column(
        modifier =
            modifier
                .background(LombadaColors.Ground, MaterialTheme.shapes.medium)
                .padding(horizontal = 14.dp, vertical = 12.dp)
                .semantics(mergeDescendants = true) {}
    ) {
        Text(
            buildAnnotatedString {
                append(value)
                if (unit != null &&
                    value != "–"
                ) {
                    withStyle(
                        SpanStyle(fontSize = 14.sp, fontWeight = FontWeight.Medium, color = LombadaColors.Paper3)
                    ) {
                        append(unit)
                    }
                }
            },
            style = MaterialTheme.typography.headlineSmall.copy(fontSize = 26.sp, lineHeight = 30.sp)
        )
        Text(label, style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp), color = LombadaColors.Paper2)
    }
}

/**
 * Barras horizontais: rótulo, barra amarela e o valor. Linhas de pessoas abrem a tela delas.
 *
 * @param bars Linhas.
 * @param showPhotos Se mostra a foto (ou as iniciais) de cada pessoa.
 * @param onOpen Abre a pessoa de uma linha, quando a linha tem `personId`.
 */
@Composable
fun BarChart(bars: List<Bar>, showPhotos: Boolean = false, onOpen: ((Bar) -> Unit)? = null) {
    val max = bars.maxOfOrNull { it.count }?.coerceAtLeast(1) ?: 1
    Column(verticalArrangement = Arrangement.spacedBy(if (showPhotos) 6.dp else 10.dp)) {
        bars.forEach { bar ->
            val clickable = onOpen != null && bar.personId != null
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = if (clickable) 48.dp else 24.dp)
                        .then(
                            if (clickable) {
                                Modifier
                                    .background(Color.Transparent, MaterialTheme.shapes.small)
                                    .clickable(role = Role.Button, onClickLabel = "Abrir ${bar.label}") {
                                        onOpen?.invoke(bar)
                                    }
                            } else {
                                Modifier
                            }
                        ).clearAndSetSemantics {
                            contentDescription =
                                "${bar.label}: ${Formatting.count(bar.count, "filme", "filmes")}"
                        }
            ) {
                if (showPhotos) PersonCircle(bar.label, bar.photo, size = 36.dp)
                Text(
                    bar.label,
                    style = MaterialTheme.typography.bodyMedium,
                    color = LombadaColors.Paper2,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.width(if (showPhotos) 104.dp else 116.dp)
                )
                Box(Modifier.weight(1f).height(12.dp)) {
                    Box(
                        Modifier
                            .fillMaxWidth(bar.count.toFloat() / max)
                            .widthIn(min = 4.dp)
                            .fillMaxHeight()
                            .background(LombadaColors.Sticker, RoundedCornerShape(topEnd = 4.dp, bottomEnd = 4.dp))
                    )
                }
                Text(
                    bar.count.toString(),
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                    textAlign = TextAlign.End,
                    modifier = Modifier.width(22.dp)
                )
            }
        }
    }
}

/**
 * Tabela de "Vocês contra a crítica": posição e nota de vocês, filme, e a posição por IMDb e
 * Letterboxd com a nota embaixo.
 *
 * @param rows Linhas.
 * @param onOpen Abre o filme.
 */
@Composable
fun CriticsTable(rows: List<CriticRow>, onOpen: (CriticRow) -> Unit) {
    val head = MaterialTheme.typography.labelMedium.copy(fontSize = 12.5.sp, color = LombadaColors.Paper3)
    Column {
        Row(modifier = Modifier.padding(bottom = 8.dp)) {
            Text(
                "Vocês",
                style = head,
                textAlign = TextAlign.Center,
                maxLines = 1,
                softWrap = false,
                modifier = Modifier.width(54.dp)
            )
            Text("Filme", style = head, modifier = Modifier.weight(1f).padding(start = 6.dp))
            Text(
                "IMDb",
                style = head,
                textAlign = TextAlign.Center,
                maxLines = 1,
                softWrap = false,
                modifier = Modifier.width(54.dp)
            )
            Text(
                "Letterb.",
                style = head,
                textAlign = TextAlign.Center,
                maxLines = 1,
                softWrap = false,
                modifier = Modifier.width(54.dp)
            )
        }
        rows.forEach { row ->
            HorizontalDivider(color = LombadaColors.Rule)
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clickable(role = Role.Button, onClickLabel = "Abrir ${row.entry.movie.title}") { onOpen(row) }
                        .padding(vertical = 9.dp)
            ) {
                NumberCell("#${row.position}", Formatting.oneDecimal(row.score))
                Column(modifier = Modifier.weight(1f).padding(start = 6.dp)) {
                    Text(
                        Formatting.shortTitle(row.entry.movie.title),
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontWeight = FontWeight.SemiBold,
                            lineHeight = 18.sp
                        )
                    )
                    Text(
                        row.why,
                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.5.sp),
                        color = if (row.youRankHigher) LombadaColors.Sticker else LombadaColors.Paper2,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                    Text(
                        Formatting.seenLine(row.entry.watchedOn),
                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                        color = LombadaColors.Paper3,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
                NumberCell("#${row.imdbPosition}", Formatting.oneDecimal(row.entry.movie.imdb))
                NumberCell("#${row.letterboxdPosition}", Formatting.oneDecimal(row.entry.movie.letterboxd))
            }
        }
    }
}

@Composable
private fun NumberCell(position: String, score: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(54.dp)) {
        Text(position, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold))
        Text(
            score,
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp, fontWeight = FontWeight.Medium),
            color = LombadaColors.Paper3,
            modifier = Modifier.padding(top = 2.dp)
        )
    }
}

/**
 * Botão "Ver os N filmes" no rodapé de um card.
 *
 * @param text Rótulo.
 * @param onClick Ação.
 */
@Composable
fun SeeAll(text: String, onClick: () -> Unit) {
    Column {
        HorizontalDivider(color = LombadaColors.Rule, modifier = Modifier.padding(top = 4.dp))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .clickable(role = Role.Button, onClick = onClick)
        ) {
            Text(
                text,
                style = MaterialTheme.typography.labelLarge,
                color = LombadaColors.Sticker,
                modifier = Modifier.weight(1f)
            )
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = LombadaColors.Sticker)
        }
    }
}

/**
 * "Filmes por mês": uma linha por ano, 12 meses com o número dentro, amarelo em 4 intensidades,
 * meses futuros tracejados, total por ano, legenda e o fato do mês com mais filmes.
 *
 * @param calendar Calendário calculado.
 */
@Composable
fun CalendarGrid(calendar: Calendar) {
    val cellStyle = MaterialTheme.typography.labelSmall.copy(fontSize = 12.sp, fontWeight = FontWeight.Bold)
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            Box(Modifier.width(36.dp))
            "JFMAMJJASOND".forEach {
                Text(
                    it.toString(),
                    style = cellStyle.copy(fontSize = 11.sp, fontWeight = FontWeight.SemiBold),
                    color = LombadaColors.Paper3,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f)
                )
            }
            Text(
                "Total",
                style = cellStyle.copy(fontSize = 11.sp, fontWeight = FontWeight.SemiBold),
                color = LombadaColors.Paper3,
                textAlign = TextAlign.End,
                modifier = Modifier.width(34.dp)
            )
        }
        calendar.years.forEach { year ->
            Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    year.year.toString(),
                    style = cellStyle.copy(fontSize = 12.5.sp),
                    color = LombadaColors.Paper2,
                    modifier = Modifier.width(36.dp)
                )
                year.months.forEach { month ->
                    val description =
                        "${Reports.monthLabel(month.month)}: " +
                            if (month.future &&
                                month.count == 0
                            ) {
                                "ainda não chegou"
                            } else {
                                Formatting.count(month.count, "filme", "filmes")
                            }
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier =
                            Modifier
                                .weight(1f)
                                .height(30.dp)
                                .then(
                                    if (month.future) {
                                        Modifier.border(
                                            BorderStroke(1.dp, LombadaColors.Rule),
                                            RoundedCornerShape(6.dp)
                                        )
                                    } else {
                                        Modifier.background(levelColor(month.level), RoundedCornerShape(6.dp))
                                    }
                                ).clearAndSetSemantics { contentDescription = description }
                    ) {
                        if (month.count > 0) {
                            Text(
                                month.count.toString(),
                                style = cellStyle,
                                color = if (month.level <=
                                    1
                                ) {
                                    LombadaColors.Paper
                                } else {
                                    LombadaColors.StickerInk
                                }
                            )
                        }
                    }
                }
                Text(
                    year.total.toString(),
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                    textAlign = TextAlign.End,
                    modifier = Modifier.width(34.dp)
                )
            }
        }
        Row(
            horizontalArrangement = Arrangement.spacedBy(4.dp, Alignment.End),
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth().padding(top = 6.dp).clearAndSetSemantics {}
        ) {
            Text(
                "menos",
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.5.sp),
                color = LombadaColors.Paper3,
                modifier = Modifier.padding(end = 2.dp)
            )
            (1..4).forEach { Box(Modifier.size(14.dp).background(levelColor(it), RoundedCornerShape(3.dp))) }
            Text(
                "mais",
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.5.sp),
                color = LombadaColors.Paper3,
                modifier = Modifier.padding(start = 2.dp)
            )
        }
        val peak = calendar.peak
        val since = calendar.since
        if (peak != null && peak.count > 0 && since != null) {
            Text(
                buildAnnotatedString {
                    val bold = SpanStyle(color = LombadaColors.Paper, fontWeight = FontWeight.SemiBold)
                    append("Mês com mais filmes: ")
                    withStyle(bold) { append(Reports.monthLabel(peak.month)) }
                    append(", com ${peak.count}. Média de ")
                    withStyle(bold) { append(Formatting.oneDecimal(calendar.monthlyAverage)) }
                    append(" por mês desde ${Reports.monthLabel(since)}.")
                },
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.5.sp, lineHeight = 20.sp),
                color = LombadaColors.Paper2,
                modifier = Modifier.padding(top = 8.dp)
            )
        }
    }
}

private fun levelColor(level: Int): Color = when (level) {
    0 -> LombadaColors.Ground
    1 -> lerp(LombadaColors.Shelf, LombadaColors.Sticker, 0.30f)
    2 -> lerp(LombadaColors.Shelf, LombadaColors.Sticker, 0.55f)
    3 -> lerp(LombadaColors.Shelf, LombadaColors.Sticker, 0.78f)
    else -> LombadaColors.Sticker
}
