package io.github.guilhermetelles.lombada

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Button
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.Source
import io.github.guilhermetelles.lombada.ui.theme.BrandMark
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import io.github.guilhermetelles.lombada.ui.theme.LombadaTheme
import io.github.guilhermetelles.lombada.ui.theme.RankSticker
import kotlinx.coroutines.tasks.await

/** Tela provisória do passo 1: mostra o tema e confere a conexão com o lombada-db. */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { LombadaTheme { ThemeCheck() } }
    }
}

@Composable
private fun ThemeCheck() {
    var order by remember { mutableStateOf(listOf("a", "b", "c")) }
    var firestore by remember { mutableStateOf("Conferindo o Firestore…") }
    LaunchedEffect(Unit) { firestore = probeFirestore() }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(LombadaColors.Ground)
                .safeDrawingPadding()
                .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            BrandMark()
            Text("Lombada", style = MaterialTheme.typography.headlineMedium)
        }
        Text("Passo 1: tema, logo e etiqueta.", color = LombadaColors.Paper2)
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            listOf("a", "b", "c").forEach { id -> key(id) { RankSticker(position = order.indexOf(id) + 1, id = id) } }
            RankSticker(position = 12, id = "z")
        }
        FilledTonalButton(onClick = { order = order.drop(1) + order.first() }) { Text("Recolar etiquetas") }
        Button(onClick = {}) { Text("Botão filled") }
        Text(firestore, color = LombadaColors.Sticker)
    }
}

/**
 * Lê um filme do lombada-db direto do servidor. Sem login, as regras negam a leitura: a negação
 * prova que o app chegou ao projeto certo.
 *
 * @return Mensagem com o resultado.
 */
private suspend fun probeFirestore(): String = try {
    val movie = FirebaseFirestore.getInstance().collection("movies").document("2756").get(Source.SERVER).await()
    "Firestore leu: ${movie.getString("title")}"
} catch (error: FirebaseFirestoreException) {
    if (error.code == FirebaseFirestoreException.Code.PERMISSION_DENIED) {
        "Firestore respondeu: leitura exige login (projeto ${FirebaseFirestore.getInstance().app.options.projectId})"
    } else {
        "Firestore falhou: ${error.code}"
    }
}
