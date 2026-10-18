package io.github.guilhermetelles.lombada.ui.queue

import androidx.compose.runtime.Composable
import io.github.guilhermetelles.lombada.ui.components.PendingScreen
import io.github.guilhermetelles.lombada.ui.main.ScreenContext

/**
 * Aba "Quero ver": a fila compartilhada de filmes que a dupla quer ver. Ponto de entrada do pacote, registrado no `MainScreen`.
 *
 * @param context Lista, pessoa logada e navegação.
 */
@Composable
fun QueueEntry(context: ScreenContext) {
    PendingScreen(title = "Quero ver")
}
