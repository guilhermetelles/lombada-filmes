package io.github.guilhermetelles.lombada

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import io.github.guilhermetelles.lombada.ui.LombadaApp
import io.github.guilhermetelles.lombada.ui.theme.LombadaTheme

/** A única Activity do app. */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { LombadaTheme { LombadaApp() } }
    }
}
