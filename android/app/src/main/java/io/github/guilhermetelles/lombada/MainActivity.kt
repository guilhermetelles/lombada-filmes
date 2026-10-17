package io.github.guilhermetelles.lombada

import android.graphics.Color
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import io.github.guilhermetelles.lombada.ui.LombadaApp
import io.github.guilhermetelles.lombada.ui.theme.LombadaTheme

/** A única Activity do app. */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Tema único escuro: ícones claros nas barras do sistema. Sem isso, o Android 13 com os três
        // botões pinta a barra de navegação de claro.
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT)
        )
        setContent { LombadaTheme { LombadaApp() } }
    }
}
