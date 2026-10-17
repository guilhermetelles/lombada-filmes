package io.github.guilhermetelles.lombada.ui.about

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.guilhermetelles.lombada.BuildConfig
import io.github.guilhermetelles.lombada.R
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.components.LombadaButton
import io.github.guilhermetelles.lombada.ui.components.LombadaButtonStyle
import io.github.guilhermetelles.lombada.ui.theme.BrandMark
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/**
 * Sobre o app: versão, a conta logada com "Sair da conta", a atribuição ao TMDb (logo e aviso,
 * exigidos pelos termos da API), as outras fontes de dados e a licença da fonte.
 *
 * @param onBack Volta.
 * @param onSignOut Sai da conta.
 */
@Composable
fun AboutScreen(onBack: () -> Unit, onSignOut: () -> Unit) {
    val container = appContainer()
    val uri = LocalUriHandler.current
    val context = LocalContext.current
    val (name, email) = remember { container.authRepository.currentAccount }
    var showLicense by rememberSaveable { mutableStateOf(false) }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(LombadaColors.Ground)
                .statusBarsPadding()
                .verticalScroll(rememberScrollState())
                .navigationBarsPadding()
                .padding(bottom = 24.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.height(56.dp).padding(horizontal = 4.dp)
        ) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar") }
            Text(
                "Sobre",
                style = MaterialTheme.typography.titleLarge.copy(fontSize = 18.sp),
                modifier = Modifier.padding(start = 4.dp)
            )
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 8.dp)
        ) {
            BrandMark(width = 64.dp)
            Column {
                Text(
                    "Lombada",
                    style = MaterialTheme.typography.headlineMedium,
                    modifier = Modifier.semantics {
                        heading()
                    }
                )
                Text(
                    "Versão ${BuildConfig.VERSION_NAME}",
                    style = MaterialTheme.typography.bodySmall,
                    color = LombadaColors.Paper3
                )
            }
        }
        Text(
            "O ranking dos filmes que vocês veem juntos: a ordem, a data e o que acharam de cada um.",
            style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 21.sp),
            color = LombadaColors.Paper2,
            modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 12.dp)
        )

        Section("Conta") {
            Text(name ?: "Conta Google", style = MaterialTheme.typography.titleSmall)
            email?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.bodySmall,
                    color = LombadaColors.Paper2,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
            LombadaButton(
                "Sair da conta",
                onClick = onSignOut,
                style = LombadaButtonStyle.OutlinedError,
                modifier = Modifier.padding(top = 12.dp).fillMaxWidth()
            )
        }

        Section("Dados dos filmes") {
            Image(
                painter = painterResource(R.drawable.tmdb_logo),
                contentDescription = null,
                modifier =
                    Modifier
                        .padding(bottom = 10.dp)
                        .height(20.dp)
                        .semantics { contentDescription = "Logo do TMDb" }
            )
            Text(
                "Este app usa a API do TMDb, mas não é endossado nem certificado pelo TMDb.",
                style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 21.sp)
            )
            Text(
                "Catálogo, sinopses, gêneros, capas, elenco, fotos e fichas de diretores e atores vêm do TMDb. " +
                    "As notas do IMDb, do Rotten Tomatoes e do Metacritic vêm da OMDb; a nota e a página de cada " +
                    "filme no Letterboxd vêm das páginas públicas do Letterboxd.",
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp, lineHeight = 19.sp),
                color = LombadaColors.Paper2,
                modifier = Modifier.padding(top = 8.dp)
            )
            TextButton(onClick = {
                uri.openUri("https://www.themoviedb.org/")
            }, modifier = Modifier.heightIn(min = 48.dp)) {
                Text("Abrir themoviedb.org", color = LombadaColors.Sticker)
            }
        }

        Section("Licenças") {
            Text(
                "Fonte Barlow, de Jeremy Tribby, sob a SIL Open Font License 1.1.",
                style = MaterialTheme.typography.bodyMedium,
                color = LombadaColors.Paper2
            )
            TextButton(onClick = { showLicense = true }, modifier = Modifier.heightIn(min = 48.dp)) {
                Text("Ver licença", color = LombadaColors.Sticker)
            }
        }
    }

    if (showLicense) {
        val text = remember { context.assets.open("licenses/barlow-OFL.txt").bufferedReader().use { it.readText() } }
        AlertDialog(
            onDismissRequest = { showLicense = false },
            containerColor = LombadaColors.Shelf,
            title = { Text("SIL Open Font License 1.1") },
            text = {
                Text(
                    text,
                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                    color = LombadaColors.Paper2,
                    modifier = Modifier.verticalScroll(rememberScrollState())
                )
            },
            confirmButton = {
                TextButton(onClick = { showLicense = false }) { Text("Fechar", color = LombadaColors.Sticker) }
            }
        )
    }
}

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Column(
        modifier =
            Modifier
                .padding(start = 16.dp, end = 16.dp, top = 16.dp)
                .fillMaxWidth()
                .background(LombadaColors.Shelf, MaterialTheme.shapes.large)
                .padding(16.dp)
    ) {
        Text(
            title,
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(bottom = 10.dp).semantics {
                heading()
            }
        )
        content()
    }
}
