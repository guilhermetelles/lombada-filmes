package io.github.guilhermetelles.lombada

import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Tela provisória do passo 0: só prova que o app compila no WSL e instala no celular. */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { EnvironmentCheck() }
    }
}

/** Cores do DESIGN.md usadas nesta tela; o tema completo vem no passo 1. */
private val Ground = Color(0xFF121433)
private val Paper = Color(0xFFF3EFE4)
private val Sticker = Color(0xFFFFD93B)

@Composable
private fun EnvironmentCheck() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Ground)
            .safeDrawingPadding()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Lombada", color = Paper, fontSize = 40.sp, fontWeight = FontWeight.ExtraBold)
        Text("Passo 0: o app compilou e foi instalado.", color = Sticker, fontSize = 18.sp)
        Text("Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})", color = Paper, fontSize = 15.sp)
    }
}
