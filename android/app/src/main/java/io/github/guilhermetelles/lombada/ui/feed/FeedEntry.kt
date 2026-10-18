package io.github.guilhermetelles.lombada.ui.feed

import androidx.compose.runtime.Composable
import io.github.guilhermetelles.lombada.ui.components.PendingScreen
import io.github.guilhermetelles.lombada.ui.main.ScreenContext

/**
 * Atividade da lista, aberta pelo sino. Ponto de entrada do pacote, registrado no `MainScreen`.
 *
 * @param context Lista, pessoa logada e navegação.
 */
@Composable
fun FeedEntry(context: ScreenContext) {
    PendingScreen(title = "Atividade", onBack = context.back)
}
