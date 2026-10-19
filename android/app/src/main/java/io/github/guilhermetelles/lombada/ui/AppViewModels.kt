package io.github.guilhermetelles.lombada.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.LombadaApplication
import io.github.guilhermetelles.lombada.domain.TitleLanguage

/**
 * Dependências do app, para criar os ViewModels nas telas.
 *
 * @return O [AppContainer] do processo.
 */
@Composable
fun appContainer(): AppContainer = (LocalContext.current.applicationContext as LombadaApplication).container

/**
 * Idioma dos títulos escolhido em "Opções", acompanhando a troca.
 *
 * @return O idioma atual.
 */
@Composable
fun titleLanguage(): TitleLanguage = appContainer().titleLanguage.language.collectAsStateWithLifecycle().value
