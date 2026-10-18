package io.github.guilhermetelles.lombada.ui.roulette

import androidx.compose.runtime.Composable
import io.github.guilhermetelles.lombada.ui.components.PendingScreen
import io.github.guilhermetelles.lombada.ui.main.ScreenContext

/**
 * Sorteio de um filme da fila. Ponto de entrada do pacote, registrado no `MainScreen`.
 *
 * @param context Lista, pessoa logada e navegação.
 */
@Composable
fun RouletteEntry(context: ScreenContext) {
    PendingScreen(title = "Sorteio", onBack = context.back)
}
