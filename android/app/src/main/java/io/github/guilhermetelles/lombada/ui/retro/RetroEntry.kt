package io.github.guilhermetelles.lombada.ui.retro

import androidx.compose.runtime.Composable
import io.github.guilhermetelles.lombada.ui.components.PendingScreen
import io.github.guilhermetelles.lombada.ui.main.RetroRoute
import io.github.guilhermetelles.lombada.ui.main.ScreenContext

/**
 * Retrospectiva de um mês. Ponto de entrada do pacote, registrado no `MainScreen`.
 *
 * @param context Lista, pessoa logada e navegação.
 * @param route Argumentos da rota.
 */
@Composable
fun RetroEntry(context: ScreenContext, route: RetroRoute) {
    PendingScreen(title = "Retrospectiva", onBack = context.back)
}
