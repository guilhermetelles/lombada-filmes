package io.github.guilhermetelles.lombada.ui.notify

import androidx.compose.runtime.Composable
import io.github.guilhermetelles.lombada.ui.components.PendingScreen
import io.github.guilhermetelles.lombada.ui.main.ScreenContext

/**
 * Configurações de notificação. Ponto de entrada do pacote, registrado no `MainScreen`.
 *
 * @param context Lista, pessoa logada e navegação.
 */
@Composable
fun NotifySettingsEntry(context: ScreenContext) {
    PendingScreen(title = "Notificações", onBack = context.back)
}
