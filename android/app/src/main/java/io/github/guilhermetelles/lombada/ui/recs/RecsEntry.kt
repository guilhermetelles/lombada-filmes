package io.github.guilhermetelles.lombada.ui.recs

import androidx.compose.runtime.Composable
import io.github.guilhermetelles.lombada.ui.components.PendingScreen
import io.github.guilhermetelles.lombada.ui.main.ScreenContext

/**
 * Aba Sugestões: filmes calculados a partir do gosto da lista e o que está em alta. Ponto de entrada do pacote, registrado no `MainScreen`.
 *
 * @param context Lista, pessoa logada e navegação.
 */
@Composable
fun RecsEntry(context: ScreenContext) {
    PendingScreen(title = "Sugestões")
}
