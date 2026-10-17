package io.github.guilhermetelles.lombada.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.guilhermetelles.lombada.ui.components.LombadaButton
import io.github.guilhermetelles.lombada.ui.list.ListPlaceholderScreen
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
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val showMessage: (String) -> Unit = { message -> scope.launch { snackbar.showSnackbar(message) } }

    Scaffold(
        containerColor = LombadaColors.Ground,
        snackbarHost = {
            SnackbarHost(snackbar) { data ->
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

                is SessionState.Ready -> ListPlaceholderScreen(current.list, onSignOut = { session.signOut(context) })

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
