package io.github.guilhermetelles.lombada.ui.list

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.FloatingActionButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/**
 * "Ir ao topo" e "ir ao fim": botões quadrados arredondados no canto inferior direito.
 *
 * @param showTop Se o de topo aparece.
 * @param showBottom Se o de fim aparece.
 * @param onTop Rola para o topo.
 * @param onBottom Rola para o fim.
 * @param modifier Modificador do Compose, para o posicionamento.
 */
@Composable
fun ScrollButtons(
    showTop: Boolean,
    showBottom: Boolean,
    onTop: () -> Unit,
    onBottom: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        ScrollButton(showTop, onTop) { Icon(Icons.Filled.ArrowUpward, contentDescription = "Voltar ao topo da lista") }
        ScrollButton(showBottom, onBottom) {
            Icon(Icons.Filled.ArrowDownward, contentDescription = "Ir para o fim da lista")
        }
    }
}

@Composable
private fun ScrollButton(visible: Boolean, onClick: () -> Unit, icon: @Composable () -> Unit) {
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn() + scaleIn(initialScale = 0.9f),
        exit =
            fadeOut() + scaleOut(targetScale = 0.9f)
    ) {
        FloatingActionButton(
            onClick = onClick,
            containerColor = LombadaColors.Tonal,
            contentColor = LombadaColors.Sticker,
            shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
            elevation = FloatingActionButtonDefaults.elevation(defaultElevation = 4.dp),
            modifier = Modifier.size(48.dp),
            content = icon
        )
    }
}
