package io.github.guilhermetelles.lombada.ui.onboarding

import android.content.ClipData
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.LocalClipboard
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.guilhermetelles.lombada.domain.InviteCode
import io.github.guilhermetelles.lombada.ui.appContainer
import kotlinx.coroutines.launch

/**
 * Entrar com código ou criar lista, e o código da lista nova.
 *
 * @param uid Pessoa logada.
 * @param adding Se a pessoa já tem lista e está adicionando outra.
 * @param onHoldNewList Segura a abertura da lista nova enquanto o código aparece.
 * @param onMessage Mostra uma mensagem curta.
 * @param onBack Voltar, no modo [adding].
 * @param onSignOut Sair da conta.
 * @param onDone Chamado quando a pessoa entra numa lista ou abre a criada.
 */
@Composable
fun OnboardingFlow(
    uid: String,
    adding: Boolean,
    onHoldNewList: (Boolean) -> Unit,
    onMessage: (String) -> Unit,
    onBack: () -> Unit,
    onSignOut: () -> Unit,
    onDone: () -> Unit = {}
) {
    val container = appContainer()
    val viewModel =
        viewModel(key = "onboarding-$uid-$adding") {
            OnboardingViewModel(container, uid, onHoldNewList) { message ->
                onMessage(message)
                onDone()
            }
        }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()

    val created = state.created
    if (created != null) {
        ListCreatedScreen(
            inviteCode = created.inviteCode,
            onCopy = {
                val text = InviteCode.format(created.inviteCode)
                scope.launch {
                    clipboard.setClipEntry(ClipEntry(ClipData.newPlainText("Código da lista", text)))
                    onMessage("Código copiado")
                }
            },
            onOpen = {
                viewModel.openCreated()
                onDone()
            }
        )
    } else {
        ChooseListScreen(
            state = state,
            adding = adding,
            onCodeChange = viewModel::onCodeChange,
            onJoin = viewModel::join,
            onNameChange = viewModel::onNameChange,
            onDescriptionChange = viewModel::onDescriptionChange,
            onCreate = viewModel::create,
            onBack = onBack,
            onSignOut = onSignOut
        )
    }
}
