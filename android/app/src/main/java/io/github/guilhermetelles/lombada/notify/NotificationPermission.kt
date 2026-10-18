package io.github.guilhermetelles.lombada.notify

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.app.NotificationManagerCompat
import androidx.lifecycle.compose.LifecycleResumeEffect

/**
 * Permissão de mostrar avisos (`POST_NOTIFICATIONS`, obrigatória desde o Android 13). Pedida só na
 * tela de configurações de notificação, nunca ao abrir o app. Criada por [rememberNotificationPermission].
 */
@Stable
class NotificationPermissionState internal constructor(granted: Boolean, private val openSettingsAction: () -> Unit) {
    /** Se o app pode mostrar avisos agora (permissão dada e avisos ligados para o app). */
    var granted by mutableStateOf(granted)
        internal set

    /**
     * Se o pedido ainda abre a janela do sistema. Depois de duas recusas o Android não mostra mais
     * a janela: aí a tela oferece [openSettings].
     */
    var canAsk by mutableStateOf(true)
        internal set

    internal var launch: () -> Unit = {}

    /** Abre a janela do sistema pedindo a permissão; sem efeito se já foi dada. */
    fun request() {
        if (!granted) launch()
    }

    /** Abre as configurações de notificação do app no Android. */
    fun openSettings() = openSettingsAction()
}

/**
 * Estado e pedido da permissão de avisos, atualizado ao voltar para o app (a pessoa pode ter mudado
 * nas configurações do Android).
 *
 * @return O estado, para a tela de configurações.
 */
@Composable
fun rememberNotificationPermission(): NotificationPermissionState {
    val context = LocalContext.current
    val state =
        remember {
            NotificationPermissionState(granted = notificationsAllowed(context)) {
                context.startActivity(
                    Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                        .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                )
            }
        }
    val launcher =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
            state.granted = ok && notificationsAllowed(context)
            if (!ok) {
                // Recusada sem justificativa pendente: o sistema não volta a mostrar a janela.
                state.canAsk =
                    context.findActivity()?.shouldShowRequestPermissionRationale(
                        Manifest.permission.POST_NOTIFICATIONS
                    ) == true
            }
        }
    state.launch = { launcher.launch(Manifest.permission.POST_NOTIFICATIONS) }
    LifecycleResumeEffect(state) {
        state.granted = notificationsAllowed(context)
        onPauseOrDispose {}
    }
    return state
}

/**
 * Se o app pode mostrar avisos: permissão dada e avisos do app ligados.
 *
 * @param context Contexto.
 * @return true quando os avisos aparecem.
 */
fun notificationsAllowed(context: Context): Boolean = NotificationManagerCompat.from(context).areNotificationsEnabled()

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}
