package io.github.guilhermetelles.lombada.ui.person

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.github.guilhermetelles.lombada.ui.detail.PersonCircle
import io.github.guilhermetelles.lombada.ui.main.PersonRoute

/**
 * Tela de um diretor ou ator.
 *
 * @param route Pessoa aberta.
 * @param onBack Volta.
 */
@Composable
fun PersonScreen(route: PersonRoute, onBack: () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .statusBarsPadding()
    ) {
        IconButton(onClick = onBack, modifier = Modifier.padding(4.dp).height(48.dp)) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
        }
        PersonCircle(route.name, route.profilePath, Modifier.padding(start = 20.dp, top = 8.dp), size = 96.dp)
        Text(
            route.name,
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.padding(start = 20.dp, top = 12.dp)
        )
    }
}
