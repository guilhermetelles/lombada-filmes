package io.github.guilhermetelles.lombada.ui.advsearch

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.guilhermetelles.lombada.domain.DiscoverSort
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/**
 * Seletor da ordem dos resultados da busca avançada, no mesmo estilo do seletor da aba Lista, com
 * uma linha que explica a ordem escolhida.
 *
 * @param sort Ordem escolhida.
 * @param onSortChange Escolheu outra ordem.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DiscoverSortBar(sort: DiscoverSort, onSortChange: (DiscoverSort) -> Unit) {
    Column(modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 20.dp)) {
        Text("Ordem", style = MaterialTheme.typography.titleSmall, modifier = Modifier.padding(bottom = 8.dp))
        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
            DiscoverSort.entries.forEachIndexed { index, option ->
                SegmentedButton(
                    modifier = Modifier.fillMaxHeight().heightIn(min = 48.dp),
                    selected = option == sort,
                    onClick = { onSortChange(option) },
                    shape = SegmentedButtonDefaults.itemShape(index, DiscoverSort.entries.size),
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
                        option.label,
                        style = MaterialTheme.typography.labelLarge.copy(fontSize = 14.sp, lineHeight = 17.sp),
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
        Text(
            when (sort) {
                DiscoverSort.Relevance ->
                    "O que mais combina com os filtros e a frase, ajustado pelo gosto de vocês."

                DiscoverSort.Compat -> "O que mais combina com o gosto de vocês primeiro."
            },
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp),
            color = LombadaColors.Paper3,
            modifier = Modifier.padding(top = 6.dp)
        )
    }
}
