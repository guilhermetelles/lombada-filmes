package io.github.guilhermetelles.lombada.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/**
 * Tela ainda sem conteúdo: título, voltar (nas telas internas) e o indicador de carregamento.
 * Ponto de partida das entradas novas até cada tela ganhar os próprios dados.
 *
 * @param title Título da tela.
 * @param onBack Voltar; null nas abas, que não têm.
 */
@Composable
fun PendingScreen(title: String, onBack: (() -> Unit)? = null) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(LombadaColors.Ground)
                .statusBarsPadding()
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier =
                Modifier
                    .height(56.dp)
                    .padding(start = if (onBack == null) 20.dp else 4.dp, end = 20.dp)
        ) {
            if (onBack != null) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
                }
            }
            Text(
                title,
                style = MaterialTheme.typography.titleLarge.copy(fontSize = 18.sp),
                modifier =
                    Modifier
                        .padding(start = if (onBack == null) 0.dp else 4.dp)
                        .semantics { heading() }
            )
        }
        Box(
            Modifier
                .fillMaxWidth()
                .padding(48.dp),
            contentAlignment = Alignment.Center
        ) { CircularProgressIndicator(color = LombadaColors.Sticker) }
    }
}
