package io.github.guilhermetelles.lombada.ui.tiers

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.guilhermetelles.lombada.ui.list.SortMode
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/**
 * Segmented button da aba Lista com os três modos do mock: "Ranking", "Ordem em que vimos" e "Tiers".
 *
 * @param mode Ordem da lista quando o modo Tiers está desligado.
 * @param tiers Se o modo Tiers está ligado.
 * @param onModeChange Escolheu uma das ordens da lista (desliga o modo Tiers).
 * @param onTiers Escolheu o modo Tiers.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ListModeBar(mode: SortMode, tiers: Boolean, onModeChange: (SortMode) -> Unit, onTiers: () -> Unit) {
    val options =
        listOf(
            Triple<String, Boolean, () -> Unit>("Ranking", !tiers && mode == SortMode.Ranking, {
                onModeChange(SortMode.Ranking)
            }),
            Triple<String, Boolean, () -> Unit>("Ordem em que vimos", !tiers && mode == SortMode.WatchedDate, {
                onModeChange(SortMode.WatchedDate)
            }),
            Triple("Tiers", tiers, onTiers)
        )
    SingleChoiceSegmentedButtonRow(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = 20.dp, end = 20.dp, top = 14.dp, bottom = 10.dp)
                // Com fonte grande, um rótulo quebra em duas linhas: os três ficam da mesma altura.
                .height(IntrinsicSize.Min)
    ) {
        options.forEachIndexed { index, (label, selected, onClick) ->
            SegmentedButton(
                modifier = Modifier.fillMaxHeight().heightIn(min = 48.dp),
                selected = selected,
                onClick = onClick,
                shape = SegmentedButtonDefaults.itemShape(index, options.size),
                icon = {},
                border = BorderStroke(1.dp, LombadaColors.Rule),
                colors =
                    SegmentedButtonDefaults.colors(
                        activeContainerColor = LombadaColors.Tonal,
                        activeContentColor = LombadaColors.Paper,
                        inactiveContainerColor = LombadaColors.Ground,
                        inactiveContentColor = LombadaColors.Paper2
                    )
            ) {
                Text(
                    label,
                    style = MaterialTheme.typography.labelLarge.copy(fontSize = 14.sp, lineHeight = 17.sp),
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

/**
 * Linha de contagem no modo Tiers: só a quantidade de filmes, sem dica de arrastar.
 *
 * @param count Quantidade de filmes.
 */
@Composable
fun TiersMeta(count: Int) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 32.dp)
                .padding(start = 20.dp, end = 12.dp, top = 2.dp, bottom = 4.dp)
    ) {
        Text(
            if (count == 1) "1 filme" else "$count filmes",
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp),
            color = LombadaColors.Paper3
        )
    }
}
