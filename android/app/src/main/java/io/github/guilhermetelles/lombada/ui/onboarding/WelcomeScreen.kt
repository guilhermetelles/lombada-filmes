package io.github.guilhermetelles.lombada.ui.onboarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.guilhermetelles.lombada.ui.components.LombadaButton
import io.github.guilhermetelles.lombada.ui.theme.BrandMark
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/**
 * Primeira tela: logo grande, o que o app faz e "Entrar com Google".
 *
 * @param signingIn Se o login está em andamento.
 * @param error Erro do último login, ou null.
 * @param onSignIn Abre a janela do Google.
 */
@Composable
fun WelcomeScreen(signingIn: Boolean, error: String?, onSignIn: () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .safeDrawingPadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
    ) {
        Spacer(Modifier.height(88.dp))
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            BrandMark(width = 96.dp)
            Text(
                "Lombada",
                style = MaterialTheme.typography.displaySmall.copy(fontSize = 38.sp),
                modifier = Modifier.semantics { heading() }
            )
            Text(
                "O ranking dos filmes que vocês veem juntos: a ordem, a data e o que acharam de cada um.",
                style = MaterialTheme.typography.bodyLarge.copy(fontSize = 16.5.sp, lineHeight = 25.sp),
                color = LombadaColors.Paper2,
                modifier = Modifier.widthIn(max = 320.dp)
            )
        }
        Spacer(Modifier.height(44.dp))
        LombadaButton(
            text = "Entrar com Google",
            onClick = onSignIn,
            busy = signingIn,
            modifier = Modifier.fillMaxWidth()
        )
        if (error != null) {
            Text(
                error,
                style = MaterialTheme.typography.bodySmall,
                color = LombadaColors.Error,
                modifier = Modifier.padding(top = 10.dp)
            )
        }
        Spacer(Modifier.height(40.dp))
    }
}
