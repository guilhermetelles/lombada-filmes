package io.github.guilhermetelles.lombada.ui.listinfo

import androidx.compose.runtime.Composable
import io.github.guilhermetelles.lombada.ui.components.PendingScreen
import io.github.guilhermetelles.lombada.ui.main.ScreenContext

/**
 * Detalhes da lista: membros, placar, vencedores e convite. Ponto de entrada do pacote, registrado no `MainScreen`.
 *
 * @param context Lista, pessoa logada e navegação.
 */
@Composable
fun ListInfoEntry(context: ScreenContext) {
    PendingScreen(title = "Detalhes da lista", onBack = context.back)
}
