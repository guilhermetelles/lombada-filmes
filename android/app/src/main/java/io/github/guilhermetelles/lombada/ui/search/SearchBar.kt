package io.github.guilhermetelles.lombada.ui.search

import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/**
 * Barra de busca M3 do mock: pílula de 56dp que fica presa no topo ao rolar a lista.
 *
 * @param query Termo.
 * @param onQueryChange Termo novo.
 * @param onClear Limpa a busca.
 */
@Composable
fun SearchBar(query: String, onQueryChange: (String) -> Unit, onClear: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val focusManager = LocalFocusManager.current
    val textStyle = MaterialTheme.typography.bodyLarge.copy(fontSize = 16.sp, color = LombadaColors.Paper)
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(LombadaColors.Ground)
                .padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 10.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .background(
                        if (focused) LombadaColors.ShelfFocus else LombadaColors.ShelfHigh,
                        RoundedCornerShape(28.dp)
                    )
                    .padding(start = 16.dp, end = 4.dp)
        ) {
            Icon(Icons.Filled.Search, contentDescription = null, tint = LombadaColors.Paper2)
            Box(
                Modifier
                    .weight(1f)
                    .padding(horizontal = 8.dp),
                contentAlignment = Alignment.CenterStart
            ) {
                if (query.isEmpty()) {
                    Text(
                        "Buscar filmes, atores ou diretores",
                        style = textStyle,
                        color = LombadaColors.Paper3,
                        maxLines = 1
                    )
                }
                BasicTextField(
                    value = query,
                    onValueChange = onQueryChange,
                    singleLine = true,
                    textStyle = textStyle,
                    cursorBrush = SolidColor(LombadaColors.Sticker),
                    interactionSource = interaction,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = { focusManager.clearFocus() }),
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .semantics { contentDescription = "Buscar filmes, atores ou diretores" }
                )
            }
            if (query.isNotEmpty()) {
                IconButton(onClick = onClear, modifier = Modifier.size(48.dp)) {
                    Icon(Icons.Filled.Close, contentDescription = "Limpar busca", tint = LombadaColors.Paper2)
                }
            }
        }
    }
}
