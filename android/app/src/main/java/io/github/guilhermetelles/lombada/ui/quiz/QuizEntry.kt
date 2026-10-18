package io.github.guilhermetelles.lombada.ui.quiz

import androidx.compose.runtime.Composable
import io.github.guilhermetelles.lombada.ui.components.PendingScreen
import io.github.guilhermetelles.lombada.ui.main.ScreenContext

/**
 * Aba Quiz: a pergunta de hoje, o placar do mês e o histórico. Ponto de entrada do pacote, registrado no `MainScreen`.
 *
 * @param context Lista, pessoa logada e navegação.
 */
@Composable
fun QuizEntry(context: ScreenContext) {
    PendingScreen(title = "Quiz")
}
