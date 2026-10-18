package io.github.guilhermetelles.lombada.ui.duel

import androidx.compose.runtime.Composable
import io.github.guilhermetelles.lombada.ui.components.PendingScreen
import io.github.guilhermetelles.lombada.ui.main.DuelRoute
import io.github.guilhermetelles.lombada.ui.main.ScreenContext

/**
 * Duelo entre duas entradas da lista. Ponto de entrada do pacote, registrado no `MainScreen`.
 *
 * @param context Lista, pessoa logada e navegação.
 * @param route Argumentos da rota.
 */
@Composable
fun DuelEntry(context: ScreenContext, route: DuelRoute) {
    PendingScreen(title = "Duelo", onBack = context.back)
}
