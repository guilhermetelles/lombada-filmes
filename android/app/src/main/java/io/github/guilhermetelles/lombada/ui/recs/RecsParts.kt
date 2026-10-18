package io.github.guilhermetelles.lombada.ui.recs

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/**
 * Selo pequeno em pílula, como "Saga", "Em alta" ou "#3 na lista".
 *
 * @param text Rótulo.
 * @param highlight Amarelo de etiqueta em vez do tonal.
 */
@Composable
fun RecBadge(text: String, highlight: Boolean = false) {
    Text(
        text,
        style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold),
        color = if (highlight) LombadaColors.StickerInk else LombadaColors.Paper,
        modifier =
            Modifier
                .background(if (highlight) LombadaColors.Sticker else LombadaColors.Tonal, MaterialTheme.shapes.small)
                .padding(horizontal = 8.dp, vertical = 3.dp)
    )
}

/**
 * Compatibilidade numa linha só, para cards e linhas de resultado: medidor curto e a porcentagem.
 * A página do filme usa o bloco completo (`CompatBlock`).
 *
 * @param score Compatibilidade, de 0 a 100.
 * @param meterWidth Largura do medidor.
 */
@Composable
fun CompatLine(score: Int, meterWidth: Dp = 64.dp) {
    val clamped = score.coerceIn(0, 100)
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.clearAndSetSemantics { contentDescription = "$clamped% de compatibilidade" }
    ) {
        Box(
            modifier =
                Modifier
                    .width(meterWidth)
                    .height(6.dp)
                    .background(LombadaColors.ShelfHigh, MaterialTheme.shapes.small)
        ) {
            Box(
                Modifier
                    .fillMaxWidth(clamped / 100f)
                    .fillMaxHeight()
                    .background(LombadaColors.Sticker, MaterialTheme.shapes.small)
            )
        }
        Text(
            "$clamped% compatível",
            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
            color = LombadaColors.Sticker
        )
    }
}

/**
 * Card de aviso em `--shelf`: título e texto, para estados vazios e explicações.
 *
 * @param title Título.
 * @param body Texto.
 * @param modifier Modificador do Compose.
 * @param color Cor do fundo.
 */
@Composable
fun NoticeCard(title: String, body: String, modifier: Modifier = Modifier, color: Color = LombadaColors.Shelf) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(color, MaterialTheme.shapes.large)
                .padding(20.dp)
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        Text(
            body,
            style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 21.sp),
            color = LombadaColors.Paper2,
            modifier = Modifier.padding(top = 4.dp)
        )
    }
}

/**
 * Chip de filtro com as cores do app (tonal com check amarelo quando ligado), alvo de 48dp.
 *
 * @param label Rótulo.
 * @param selected Se está ligado.
 * @param onClick Liga ou desliga.
 * @param modifier Modificador do Compose.
 */
@Composable
fun LombadaFilterChip(label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(label) },
        leadingIcon =
            if (selected) {
                { Icon(Icons.Filled.Check, contentDescription = null) }
            } else {
                null
            },
        colors =
            FilterChipDefaults.filterChipColors(
                containerColor = LombadaColors.Ground,
                labelColor = LombadaColors.Paper2,
                selectedContainerColor = LombadaColors.Tonal,
                selectedLabelColor = LombadaColors.Paper,
                selectedLeadingIconColor = LombadaColors.Sticker
            ),
        modifier = modifier.heightIn(min = 48.dp)
    )
}
