package io.github.guilhermetelles.lombada.ui.list

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.SwapVert
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.guilhermetelles.lombada.ui.theme.BrandMark
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/**
 * Top app bar: logo e "Lombada", com espaço para ações à direita.
 *
 * @param actions Ações à direita.
 */
@Composable
fun LombadaTopBar(actions: @Composable () -> Unit = {}) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .padding(start = 20.dp, end = 8.dp, top = 8.dp)
    ) {
        BrandMark()
        Text(
            "Lombada",
            style = MaterialTheme.typography.headlineMedium.copy(letterSpacing = 0.26.sp),
            modifier = Modifier.weight(1f)
        )
        actions()
    }
}

/**
 * Nome da lista (botão com chevron que abre "Suas listas") e a descrição.
 *
 * @param name Nome.
 * @param description Descrição.
 * @param onSwitch Abre o seletor de listas.
 */
@Composable
fun ListTitle(name: String, description: String, onSwitch: () -> Unit) {
    Column(modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 2.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier =
                Modifier
                    .heightIn(min = 48.dp)
                    .clickable(role = Role.Button, onClickLabel = "Trocar de lista", onClick = onSwitch)
                    .semantics { heading() }
        ) {
            Text(name, style = MaterialTheme.typography.headlineSmall, modifier = Modifier.weight(1f, fill = false))
            Icon(
                Icons.Filled.KeyboardArrowDown,
                contentDescription = null,
                tint = LombadaColors.Paper2,
                modifier = Modifier.padding(start = 4.dp)
            )
        }
        if (description.isNotBlank()) {
            Text(
                description,
                style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 20.sp),
                color = LombadaColors.Paper2,
                modifier = Modifier.widthIn(max = 340.dp)
            )
        }
    }
}

/**
 * Segmented button "Ranking / Ordem em que vimos".
 *
 * @param mode Ordem atual.
 * @param onModeChange Nova ordem.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SortBar(mode: SortMode, onModeChange: (SortMode) -> Unit) {
    val options = listOf(SortMode.Ranking to "Ranking", SortMode.WatchedDate to "Ordem em que vimos")
    SingleChoiceSegmentedButtonRow(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = 20.dp, end = 20.dp, top = 14.dp, bottom = 10.dp)
    ) {
        options.forEachIndexed { index, (value, label) ->
            SegmentedButton(
                selected = mode == value,
                onClick = { onModeChange(value) },
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
            ) { Text(label, style = MaterialTheme.typography.labelLarge.copy(fontSize = 14.sp)) }
        }
    }
}

/**
 * Linha com a quantidade de filmes e a dica de arrastar, ou o botão que inverte a ordem por data.
 *
 * @param count Quantidade de filmes.
 * @param mode Ordem atual.
 * @param newestFirst Na ordem por data, se as mais recentes vêm primeiro.
 * @param onToggleDirection Inverte a ordem por data.
 */
@Composable
fun ListMeta(count: Int, mode: SortMode, newestFirst: Boolean, onToggleDirection: () -> Unit) {
    val style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp)
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 32.dp)
                .padding(start = 20.dp, end = 12.dp, top = 2.dp, bottom = 4.dp)
    ) {
        Text(if (count == 1) "1 filme" else "$count filmes", style = style, color = LombadaColors.Paper3)
        if (mode == SortMode.Ranking) {
            Text(
                "Arraste pela alça para reordenar",
                style = style,
                color = LombadaColors.Paper3,
                modifier = Modifier.padding(end = 8.dp)
            )
        } else {
            val label = if (newestFirst) "Mais recentes primeiro" else "Mais antigos primeiro"
            TextButton(
                onClick = onToggleDirection,
                modifier =
                    Modifier.semantics {
                        contentDescription =
                            if (newestFirst) {
                                "Mostrando mais recentes primeiro; tocar para mostrar mais antigos primeiro"
                            } else {
                                "Mostrando mais antigos primeiro; tocar para mostrar mais recentes primeiro"
                            }
                    }
            ) {
                Icon(
                    Icons.Filled.SwapVert,
                    contentDescription = null,
                    tint = LombadaColors.Sticker,
                    modifier = Modifier.size(18.dp)
                )
                Text(
                    label,
                    style = style.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold),
                    color = LombadaColors.Sticker,
                    modifier = Modifier.padding(start = 4.dp)
                )
            }
        }
    }
}
