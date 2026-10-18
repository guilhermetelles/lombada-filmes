package io.github.guilhermetelles.lombada.ui.quiz

import androidx.compose.runtime.Composable
import io.github.guilhermetelles.lombada.ui.components.PendingScreen
import io.github.guilhermetelles.lombada.ui.main.QuizPlayRoute
import io.github.guilhermetelles.lombada.ui.main.ScreenContext

/**
 * Pergunta do quiz de um dia. Ponto de entrada do pacote, registrado no `MainScreen`.
 *
 * @param context Lista, pessoa logada e navegação.
 * @param route Argumentos da rota.
 */
@Composable
fun QuizPlayEntry(context: ScreenContext, route: QuizPlayRoute) {
    PendingScreen(title = "Quiz do dia", onBack = context.back)
}
