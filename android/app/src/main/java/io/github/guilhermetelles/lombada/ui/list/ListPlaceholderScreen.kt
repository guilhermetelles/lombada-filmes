package io.github.guilhermetelles.lombada.ui.list

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
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
import androidx.compose.ui.unit.dp
import io.github.guilhermetelles.lombada.data.model.MovieList
import io.github.guilhermetelles.lombada.ui.theme.BrandMark
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/**
 * Cabeçalho da lista ativa, provisório até a lista completa do passo 3.
 *
 * @param list Lista ativa.
 * @param onSignOut Sair da conta.
 */
@Composable
fun ListPlaceholderScreen(list: MovieList, onSignOut: () -> Unit) {
    var menuOpen by remember { mutableStateOf(false) }
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .safeDrawingPadding()
    ) {
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
            Text("Lombada", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.weight(1f))
            Box {
                IconButton(onClick = {
                    menuOpen = true
                }) { Icon(Icons.Filled.MoreVert, contentDescription = "Mais opções") }
                DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                    DropdownMenuItem(text = { Text("Sair da conta") }, onClick = {
                        menuOpen = false
                        onSignOut()
                    })
                }
            }
        }
        Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 2.dp)) {
            Text(list.name, style = MaterialTheme.typography.headlineSmall)
            Text(
                list.description,
                style = MaterialTheme.typography.bodyMedium,
                color = LombadaColors.Paper2,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
    }
}
