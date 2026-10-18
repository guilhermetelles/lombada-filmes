package io.github.guilhermetelles.lombada

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import io.github.guilhermetelles.lombada.notify.NotificationChannels
import io.github.guilhermetelles.lombada.notify.PushRouter
import io.github.guilhermetelles.lombada.notify.PushTarget
import io.github.guilhermetelles.lombada.ui.LombadaApp
import io.github.guilhermetelles.lombada.ui.theme.LombadaTheme

/** A única Activity do app. Também recebe o toque nos avisos (extras de [PushTarget]). */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Os canais precisam existir antes do primeiro push, inclusive dos que o sistema mostra sozinho.
        NotificationChannels.ensure(this)
        // Recriada (girar a tela, voltar do segundo plano): o toque já foi tratado.
        if (savedInstanceState == null) handlePush(intent)
        // Tema único escuro: ícones claros nas barras do sistema. Sem isso, o Android 13 com os três
        // botões pinta a barra de navegação de claro.
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT)
        )
        setContent { LombadaTheme { LombadaApp() } }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handlePush(intent)
    }

    private fun handlePush(intent: Intent?) {
        val extras = intent?.extras ?: return
        val target = PushTarget.parse { key -> extras.getString(key) } ?: return
        PushRouter.offer(target)
        // Tira os extras, para o mesmo toque não abrir a tela de novo.
        PushTarget.EXTRAS.forEach(intent::removeExtra)
    }
}
