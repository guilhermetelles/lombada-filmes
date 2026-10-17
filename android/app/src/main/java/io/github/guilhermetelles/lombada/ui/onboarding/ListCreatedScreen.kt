package io.github.guilhermetelles.lombada.ui.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.guilhermetelles.lombada.domain.InviteCode
import io.github.guilhermetelles.lombada.ui.components.LombadaButton
import io.github.guilhermetelles.lombada.ui.components.LombadaButtonStyle
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/**
 * "Lista criada": o código grande para mandar para a outra pessoa.
 *
 * @param inviteCode Código sem traço.
 * @param onCopy Copia o código.
 * @param onOpen Abre a lista.
 */
@Composable
fun ListCreatedScreen(inviteCode: String, onCopy: () -> Unit, onOpen: () -> Unit) {
    val formatted = InviteCode.format(inviteCode)
    Column(
        verticalArrangement = Arrangement.spacedBy(10.dp),
        modifier =
            Modifier
                .fillMaxSize()
                .safeDrawingPadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(top = 48.dp, bottom = 40.dp)
    ) {
        Text(
            "Lista criada",
            style = MaterialTheme.typography.headlineLarge.copy(fontSize = 28.sp),
            modifier = Modifier.semantics {
                heading()
            }
        )
        Text(
            "Mande este código para quem vai ver os filmes com você. Ele vale por 7 dias, e qualquer pessoa da lista pode gerar outro depois.",
            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.5.sp, lineHeight = 22.sp),
            color = LombadaColors.Paper2
        )
        Text(
            formatted,
            style = MaterialTheme.typography.displaySmall.copy(fontSize = 36.sp, letterSpacing = 3.6.sp),
            color = LombadaColors.Sticker,
            textAlign = TextAlign.Center,
            modifier =
                Modifier
                    .padding(top = 8.dp)
                    .fillMaxWidth()
                    .background(LombadaColors.Shelf, MaterialTheme.shapes.large)
                    .padding(vertical = 22.dp, horizontal = 16.dp)
                    .semantics { contentDescription = "Código ${formatted.toCharArray().joinToString(" ")}" }
        )
        LombadaButton(
            "Copiar código",
            onClick = onCopy,
            style = LombadaButtonStyle.Text,
            modifier = Modifier.align(Alignment.CenterHorizontally)
        )
        LombadaButton("Abrir a lista", onClick = onOpen, modifier = Modifier.fillMaxWidth())
    }
}
