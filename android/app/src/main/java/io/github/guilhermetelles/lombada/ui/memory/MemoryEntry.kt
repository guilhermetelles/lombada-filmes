package io.github.guilhermetelles.lombada.ui.memory

import androidx.compose.runtime.Composable
import io.github.guilhermetelles.lombada.ui.components.PendingScreen
import io.github.guilhermetelles.lombada.ui.main.MemoryRoute
import io.github.guilhermetelles.lombada.ui.main.ScreenContext

/**
 * Comentário do dia. Ponto de entrada do pacote, registrado no `MainScreen`.
 *
 * @param context Lista, pessoa logada e navegação.
 * @param route Argumentos da rota.
 */
@Composable
fun MemoryEntry(context: ScreenContext, route: MemoryRoute) {
    PendingScreen(title = "Comentário do dia", onBack = context.back)
}
