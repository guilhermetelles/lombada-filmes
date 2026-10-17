package io.github.guilhermetelles.lombada.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.LombadaApplication

/**
 * Dependências do app, para criar os ViewModels nas telas.
 *
 * @return O [AppContainer] do processo.
 */
@Composable
fun appContainer(): AppContainer = (LocalContext.current.applicationContext as LombadaApplication).container
