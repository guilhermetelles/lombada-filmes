package io.github.guilhermetelles.lombada.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.guilhermetelles.lombada.ui.components.LombadaButton
import io.github.guilhermetelles.lombada.ui.lists.ListsSheet
import io.github.guilhermetelles.lombada.ui.main.MainScreen
import io.github.guilhermetelles.lombada.ui.onboarding.OnboardingFlow
import io.github.guilhermetelles.lombada.ui.onboarding.WelcomeScreen
import io.github.guilhermetelles.lombada.ui.session.SessionState
import io.github.guilhermetelles.lombada.ui.session.SessionViewModel
import io.github.guilhermetelles.lombada.ui.theme.BrandMark
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import kotlinx.coroutines.launch

/** Raiz do app: escolhe a tela conforme a sessão e guarda o snackbar comum. */
@Composable
fun LombadaApp() {
    val container = appContainer()
    val session = viewModel { SessionViewModel(container) }
    val state by session.state.collectAsStateWithLifecycle()
    val signingIn by session.signingIn.collectAsStateWithLifecycle()
    val signInError by session.signInError.collectAsStateWithLifecycle()
    val snackbar = container.snackbar
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val showMessage: (String) -> Unit = { message -> scope.launch { snackbar.showSnackbar(message) } }

    Scaffold(
        containerColor = LombadaColors.Ground,
        // Cada tela cuida dos próprios insets (barra de status, teclado, navegação).
        contentWindowInsets = WindowInsets(0),
        snackbarHost = {
            SnackbarHost(snackbar, modifier = Modifier.navigationBarsPadding().imePadding()) { data ->
                Snackbar(
                    data,
                    containerColor = LombadaColors.Inverse,
                    contentColor = LombadaColors.OnInverse,
                    actionColor = LombadaColors.Tonal
                )
            }
        }
    ) { padding ->
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(LombadaColors.Ground)
                    .padding(bottom = padding.calculateBottomPadding())
        ) {
            when (val current = state) {
                SessionState.Loading -> Splash()

                SessionState.SignedOut -> WelcomeScreen(signingIn, signInError) { session.signIn(context) }

                is SessionState.NeedsList ->
                    OnboardingFlow(
                        uid = current.uid,
                        adding = false,
                        onHoldNewList = session::holdNewList,
                        onMessage = showMessage,
                        onBack = {},
                        onSignOut = { session.signOut(context) }
                    )

                is SessionState.Ready -> ReadyApp(current, session, showMessage)

                is SessionState.Failed -> Failure(current.message, onSignOut = { session.signOut(context) })
            }
        }
    }
}

@Composable
private fun Splash() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { BrandMark(width = 96.dp) }
}

@Composable
private fun Failure(message: String, onSignOut: () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .safeDrawingPadding()
                .padding(20.dp)
    ) {
        Text(
            message,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.padding(top = 88.dp, bottom = 16.dp)
        )
        LombadaButton("Sair da conta", onClick = onSignOut)
    }
}

/** Como a pessoa chegou em "Adicionar uma lista". */
private enum class AddingMode {
    Join,
    Create
}

/**
 * App com lista aberta, mais "Suas listas" e o modo "Adicionar uma lista" por cima.
 *
 * @param ready Sessão com a lista ativa.
 * @param session Sessão, para trocar de lista e sair.
 * @param showMessage Mostra uma mensagem curta.
 */
@Composable
private fun ReadyApp(ready: SessionState.Ready, session: SessionViewModel, showMessage: (String) -> Unit) {
    val context = LocalContext.current
    var sheetOpen by rememberSaveable { mutableStateOf(false) }
    var adding by rememberSaveable { mutableStateOf<AddingMode?>(null) }
    var addingCount by rememberSaveable { mutableIntStateOf(0) }

    // Trocar de lista recomeça a navegação na lista nova.
    key(ready.list.id) {
        MainScreen(
            list = ready.list,
            uid = ready.uid,
            onSwitchList = { sheetOpen = true },
            onSignOut = { session.signOut(context) }
        )
    }
    if (sheetOpen) {
        ListsSheet(
            uid = ready.uid,
            active = ready.list,
            lists = ready.lists,
            onPick = {
                sheetOpen = false
                session.openList(it)
            },
            onJoin = {
                sheetOpen = false
                addingCount++
                adding = AddingMode.Join
            },
            onCreate = {
                sheetOpen = false
                addingCount++
                adding = AddingMode.Create
            },
            onDismiss = { sheetOpen = false }
        )
    }
    if (adding != null) {
        BackHandler { adding = null }
        Box(
            Modifier
                .fillMaxSize()
                .background(LombadaColors.Ground)
        ) {
            OnboardingFlow(
                uid = ready.uid,
                adding = true,
                onHoldNewList = session::holdNewList,
                onMessage = showMessage,
                onBack = { adding = null },
                onSignOut = {},
                onDone = { adding = null },
                instance = addingCount
            )
        }
    }
}
