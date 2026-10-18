package io.github.guilhermetelles.lombada.ui.tiers

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
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
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.domain.TierBand
import io.github.guilhermetelles.lombada.domain.Tiers
import io.github.guilhermetelles.lombada.ui.components.MovieCover
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/** Cores clássicas das tier lists (as do mock), para serem reconhecidas de cara. */
private val TIER_COLORS =
    mapOf(
        "s" to Color(0xFFFF7F7F),
        "a" to Color(0xFFFFBF7F),
        "b" to Color(0xFFFFDF7F),
        "c" to Color(0xFFBFFF7F),
        "f" to Color(0xFF7FBFFF)
    )

/** Tinta escura sobre as cores das faixas. */
private val TIER_INK = Color(0xFF1B1B1F)

/**
 * Modo "Tiers" da aba Lista: o mesmo ranking em faixas S, A, B, C e F pela posição, com os cortes
 * do mock. Só lê o ranking; tocar numa capa abre o filme.
 *
 * @param ranking Entradas na ordem do ranking (não vazio).
 * @param onOpenEntry Abre o filme de uma entrada.
 */
@Composable
fun TierList(ranking: List<Entry>, onOpenEntry: (Entry) -> Unit) {
    var presetId by rememberSaveable { mutableStateOf(Tiers.PRESETS.first().id) }
    val preset = Tiers.preset(presetId)
    val bands = remember(ranking, preset) { Tiers.bands(ranking, preset) }

    Column(modifier = Modifier.fillMaxWidth().padding(bottom = 96.dp)) {
        Text(
            "O ranking de vocês em faixas, pela posição. Mudou a ordem na lista, muda aqui. " +
                "Toque numa capa para abrir o filme.",
            style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 21.sp),
            color = LombadaColors.Paper2,
            modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 12.dp).widthIn(max = 420.dp)
        )
        Text(
            "Corte das faixas",
            style = MaterialTheme.typography.labelMedium.copy(fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold),
            color = LombadaColors.Paper3,
            modifier = Modifier.padding(start = 20.dp, end = 20.dp)
        )
        PresetChips(presetId) { presetId = it }
        Text(
            Tiers.cutLabel(preset),
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.5.sp),
            color = LombadaColors.Paper3,
            modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 14.dp)
        )
        Column(
            verticalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.padding(horizontal = 12.dp)
        ) {
            bands.forEach { band -> TierRow(band, onOpenEntry) }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PresetChips(selected: String, onSelect: (String) -> Unit) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.padding(horizontal = 20.dp)
    ) {
        Tiers.PRESETS.forEach { preset ->
            val on = preset.id == selected
            FilterChip(
                selected = on,
                onClick = { onSelect(preset.id) },
                label = { Text(preset.label) },
                leadingIcon =
                    if (on) {
                        { Icon(Icons.Filled.Check, contentDescription = null, modifier = Modifier.size(18.dp)) }
                    } else {
                        null
                    },
                colors =
                    FilterChipDefaults.filterChipColors(
                        selectedContainerColor = LombadaColors.Tonal,
                        selectedLabelColor = LombadaColors.Paper,
                        selectedLeadingIconColor = LombadaColors.Sticker,
                        labelColor = LombadaColors.Paper2
                    )
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TierRow(band: TierBand<Entry>, onOpenEntry: (Entry) -> Unit) {
    val empty = band.items.isEmpty()
    val range = if (empty) "—" else "#${band.from}–${band.to}"
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(IntrinsicSize.Min)
                .heightIn(min = 92.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(LombadaColors.Shelf)
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(2.dp),
            modifier =
                Modifier
                    .width(56.dp)
                    .fillMaxHeight()
                    .background(TIER_COLORS.getValue(band.id))
                    .padding(horizontal = 2.dp, vertical = 14.dp)
                    .clearAndSetSemantics {
                        contentDescription =
                            if (empty) {
                                "Faixa ${band.letter}, vazia"
                            } else {
                                "Faixa ${band.letter}, posições ${band.from} a ${band.to}"
                            }
                    }
        ) {
            Text(
                band.letter,
                style = MaterialTheme.typography.headlineMedium.copy(
                    fontSize = 30.sp,
                    lineHeight = 30.sp,
                    fontWeight = FontWeight.ExtraBold
                ),
                color = TIER_INK
            )
            Text(
                range,
                style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.5.sp, fontWeight = FontWeight.Bold),
                color = TIER_INK.copy(alpha = 0.75f)
            )
        }
        if (empty) {
            Text(
                "Nenhum filme nesta faixa",
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp),
                color = LombadaColors.Paper3,
                modifier = Modifier.padding(12.dp)
            )
        } else {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.weight(1f).padding(8.dp)
            ) {
                band.items.forEachIndexed { index, entry ->
                    TierFilm(entry, band.from + index) { onOpenEntry(entry) }
                }
            }
        }
    }
}

@Composable
private fun TierFilm(entry: Entry, position: Int, onClick: () -> Unit) {
    Box(
        modifier =
            Modifier
                .width(46.dp)
                .clip(RoundedCornerShape(4.dp))
                .clickable(role = Role.Button, onClick = onClick)
                .semantics(mergeDescendants = true) {
                    contentDescription = "#$position, ${entry.movie.title}"
                }
    ) {
        MovieCover(
            title = entry.movie.title,
            posterPath = entry.movie.posterPath,
            seed = entry.tmdbId,
            modifier = Modifier.fillMaxWidth(),
            initialsSize = 11.sp
        )
        Box(
            contentAlignment = Alignment.Center,
            modifier =
                Modifier
                    .align(Alignment.BottomStart)
                    .padding(2.dp)
                    .heightIn(min = 18.dp)
                    .widthIn(min = 18.dp)
                    .background(LombadaColors.Sticker, RoundedCornerShape(9.dp))
                    .padding(horizontal = 4.dp)
                    .clearAndSetSemantics {}
        ) {
            Text(
                position.toString(),
                style = MaterialTheme.typography.labelSmall.copy(
                    fontSize = 10.5.sp,
                    lineHeight = 12.sp,
                    fontWeight = FontWeight.ExtraBold
                ),
                color = LombadaColors.StickerInk
            )
        }
    }
}
