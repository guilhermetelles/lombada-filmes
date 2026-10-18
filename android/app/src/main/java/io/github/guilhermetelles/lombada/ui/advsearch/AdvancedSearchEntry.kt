package io.github.guilhermetelles.lombada.ui.advsearch

import androidx.compose.runtime.Composable
import io.github.guilhermetelles.lombada.ui.components.PendingScreen
import io.github.guilhermetelles.lombada.ui.main.ScreenContext

/**
 * Busca avançada, com filtros e texto livre. Ponto de entrada do pacote, registrado no `MainScreen`.
 *
 * @param context Lista, pessoa logada e navegação.
 */
@Composable
fun AdvancedSearchEntry(context: ScreenContext) {
    PendingScreen(title = "Busca avançada", onBack = context.back)
}
