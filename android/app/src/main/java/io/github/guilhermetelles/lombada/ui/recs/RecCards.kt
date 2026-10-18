package io.github.guilhermetelles.lombada.ui.recs

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.guilhermetelles.lombada.domain.QueueLines
import io.github.guilhermetelles.lombada.domain.RecOrigin
import io.github.guilhermetelles.lombada.domain.RecsLines
import io.github.guilhermetelles.lombada.ui.components.LombadaButton
import io.github.guilhermetelles.lombada.ui.components.LombadaButtonStyle
import io.github.guilhermetelles.lombada.ui.components.MovieCover
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/**
 * Card de uma sugestão: capa, selo do tipo, título, ano, compatibilidade, motivo (marcado quando
 * é do Gemini), "por causa de" com os filmes da lista, onde assistir, "Quero ver" e "Não quero".
 *
 * @param row Sugestão.
 * @param onOpen Abre a página do filme.
 * @param onOpenOrigin Abre a página de um filme da lista citado em "por causa de".
 * @param onWant Põe na fila.
 * @param onDismiss Recusa a sugestão.
 */
@Composable
fun RecCard(
    row: RecRow,
    onOpen: () -> Unit,
    onOpenOrigin: (RecOrigin) -> Unit,
    onWant: () -> Unit,
    onDismiss: () -> Unit
) {
    val item = row.item
    Column(
        modifier =
            Modifier
                .padding(start = 20.dp, end = 20.dp, top = 12.dp)
                .fillMaxWidth()
                .background(LombadaColors.Shelf, MaterialTheme.shapes.large)
                .padding(14.dp)
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(role = Role.Button, onClickLabel = "Abrir ${item.title}", onClick = onOpen)
                    .semantics(mergeDescendants = true) {}
        ) {
            MovieCover(item.title, item.posterPath, item.tmdbId, Modifier.width(76.dp), initialsSize = 16.sp)
            Column(verticalArrangement = Arrangement.spacedBy(5.dp), modifier = Modifier.weight(1f)) {
                row.label?.let { RecBadge(it, highlight = item.source != "model") }
                Text(item.title, style = MaterialTheme.typography.titleSmall.copy(fontSize = 16.sp))
                RecsLines.meta(item.year, item.runtime, item.genres).takeIf { it.isNotEmpty() }?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = LombadaColors.Paper3)
                }
                CompatLine(item.score)
            }
        }
        Reason(item.reason, row.generated, Modifier.padding(top = 12.dp))
        if (row.origins.isNotEmpty()) {
            Origins(row.origins, onOpenOrigin)
        }
        if (item.providers.isNotEmpty()) {
            QueueLines.where(item.providers)?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.bodySmall,
                    color = LombadaColors.Paper3,
                    modifier = Modifier.padding(top = 6.dp)
                )
            }
        }
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(top = 10.dp)
        ) {
            WantButton(row, onWant)
            LombadaButton("Não quero", onClick = onDismiss, style = LombadaButtonStyle.Text)
        }
    }
}

/**
 * Card estreito da fileira "Em alta para vocês": capa com o selo, título, ano, compatibilidade,
 * motivo curto e "Quero ver".
 *
 * @param row Filme em alta ou em cartaz.
 * @param onOpen Abre a página do filme.
 * @param onWant Põe na fila.
 */
@Composable
fun TrendingCard(row: RecRow, onOpen: () -> Unit, onWant: () -> Unit) {
    val item = row.item
    Column(modifier = Modifier.width(140.dp)) {
        Column(
            verticalArrangement = Arrangement.spacedBy(4.dp),
            modifier =
                Modifier
                    .clickable(role = Role.Button, onClickLabel = "Abrir ${item.title}", onClick = onOpen)
                    .semantics(mergeDescendants = true) {}
        ) {
            Box {
                MovieCover(item.title, item.posterPath, item.tmdbId, Modifier.fillMaxWidth(), initialsSize = 24.sp)
                row.label?.let {
                    Box(Modifier.padding(6.dp)) { RecBadge(it, highlight = true) }
                }
            }
            Text(
                buildAnnotatedString {
                    append(item.title)
                    item.year?.let {
                        withStyle(SpanStyle(color = LombadaColors.Paper3, fontWeight = FontWeight.Normal)) {
                            append("  $it")
                        }
                    }
                },
                style = MaterialTheme.typography.titleSmall,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 4.dp)
            )
            Text(
                "${item.score.coerceIn(0, 100)}% compatível",
                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                color = LombadaColors.Sticker
            )
            if (item.reason.isNotBlank()) {
                Text(
                    item.reason.trim(),
                    style = MaterialTheme.typography.bodySmall,
                    color = LombadaColors.Paper2,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
        WantButton(row, onWant, compact = true)
    }
}

@Composable
private fun WantButton(row: RecRow, onWant: () -> Unit, compact: Boolean = false) {
    val label = if (row.inQueue) "Na fila" else "Quero ver"
    LombadaButton(
        label,
        onClick = onWant,
        style = if (compact) LombadaButtonStyle.Text else LombadaButtonStyle.Tonal,
        enabled = !row.inQueue,
        busy = row.busy
    )
}

@Composable
private fun Reason(reason: String, generated: Boolean, modifier: Modifier = Modifier) {
    val text = reason.trim()
    if (text.isEmpty()) return
    Column(modifier = modifier) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            if (generated) {
                Icon(
                    Icons.Filled.AutoAwesome,
                    contentDescription = null,
                    tint = LombadaColors.Sticker,
                    modifier = Modifier.size(16.dp).padding(top = 2.dp)
                )
            }
            Text(
                text,
                style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 21.sp),
                color = LombadaColors.Paper
            )
        }
        if (generated) {
            Text(
                "Motivo escrito pelo Gemini a partir dos comentários de vocês",
                style = MaterialTheme.typography.labelSmall,
                color = LombadaColors.Paper3,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
    }
}

@Composable
private fun Origins(origins: List<RecOrigin>, onOpen: (RecOrigin) -> Unit) {
    Column(modifier = Modifier.padding(top = 8.dp)) {
        Text("Por causa de", style = MaterialTheme.typography.labelMedium, color = LombadaColors.Paper3)
        origins.forEach { origin ->
            Text(
                buildAnnotatedString {
                    withStyle(SpanStyle(color = LombadaColors.Sticker, fontWeight = FontWeight.Bold)) {
                        append("#${origin.position}  ")
                    }
                    append(origin.title)
                },
                style = MaterialTheme.typography.bodyMedium,
                color = LombadaColors.Paper,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .clickable(role = Role.Button, onClickLabel = "Abrir ${origin.title}") { onOpen(origin) }
                        .padding(vertical = 13.dp)
            )
        }
    }
}
