package io.github.guilhermetelles.lombada.ui.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.guilhermetelles.lombada.ui.components.LombadaButton
import io.github.guilhermetelles.lombada.ui.components.LombadaButtonStyle
import io.github.guilhermetelles.lombada.ui.components.LombadaTextField
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/**
 * "Como vocês querem começar?": entrar com código ou criar uma lista. No modo [adding] (vindo do
 * seletor de listas), vira "Adicionar uma lista", com voltar.
 *
 * @param state Estado dos cards.
 * @param adding Se a pessoa já tem lista e está adicionando outra.
 * @param onCodeChange Código digitado.
 * @param onJoin Entrar na lista.
 * @param onNameChange Nome digitado.
 * @param onDescriptionChange Descrição digitada.
 * @param onCreate Criar a lista.
 * @param onBack Voltar, no modo [adding].
 * @param onSignOut Sair da conta, no primeiro acesso.
 */
@Composable
fun ChooseListScreen(
    state: OnboardingUiState,
    adding: Boolean,
    onCodeChange: (String) -> Unit,
    onJoin: () -> Unit,
    onNameChange: (String) -> Unit,
    onDescriptionChange: (String) -> Unit,
    onCreate: () -> Unit,
    onBack: () -> Unit,
    onSignOut: () -> Unit
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .safeDrawingPadding()
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier =
                Modifier
                    .heightIn(min = 56.dp)
                    .padding(top = 8.dp)
        ) {
            if (adding) {
                IconButton(onClick = onBack, modifier = Modifier.padding(end = 4.dp)) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
                }
            }
            Text(
                if (adding) "Adicionar uma lista" else "Como vocês querem começar?",
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.semantics { heading() }
            )
        }
        Text(
            if (adding) {
                "Entre em outra lista com um código ou crie uma nova. As listas em que você entrar ficam salvas no menu."
            } else {
                "Entre numa lista que alguém já criou ou comece uma nova."
            },
            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.5.sp, lineHeight = 22.sp),
            color = LombadaColors.Paper2
        )
        Spacer(Modifier.height(14.dp))
        OnboardingCard {
            CardTitle("Tenho um código")
            Text(
                "Quem já está na lista encontra o código tocando no nome dela.",
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.5.sp, lineHeight = 20.sp),
                color = LombadaColors.Paper2
            )
            LombadaTextField(
                value = state.code,
                onValueChange = onCodeChange,
                label = "Código da lista",
                placeholder = "ABC-123",
                error = state.codeError,
                textStyle = MaterialTheme.typography.bodyLarge.copy(
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 2.sp
                ),
                keyboardOptions =
                    KeyboardOptions(
                        capitalization = KeyboardCapitalization.Characters,
                        autoCorrectEnabled = false,
                        keyboardType = KeyboardType.Ascii,
                        imeAction = ImeAction.Go
                    ),
                keyboardActions = KeyboardActions(onGo = { onJoin() }),
                visualTransformation = InviteCodeTransformation
            )
            LombadaButton("Entrar na lista", onClick = onJoin, busy = state.joining, modifier = Modifier.fillMaxWidth())
        }
        Spacer(Modifier.height(14.dp))
        OnboardingCard {
            CardTitle("Criar uma lista")
            LombadaTextField(
                value = state.name,
                onValueChange = onNameChange,
                label = "Nome",
                placeholder = "Maratona de terror de outubro",
                error = state.nameError,
                keyboardOptions = KeyboardOptions(
                    capitalization = KeyboardCapitalization.Sentences,
                    imeAction = ImeAction.Next
                )
            )
            LombadaTextField(
                value = state.description,
                onValueChange = onDescriptionChange,
                label = "Descrição",
                optional = true,
                placeholder = "Para que serve esta lista",
                keyboardOptions = KeyboardOptions(
                    capitalization = KeyboardCapitalization.Sentences,
                    imeAction = ImeAction.Done
                ),
                keyboardActions = KeyboardActions(onDone = { onCreate() })
            )
            LombadaButton(
                "Criar lista",
                onClick = onCreate,
                style = LombadaButtonStyle.Tonal,
                busy = state.creating,
                modifier = Modifier.fillMaxWidth()
            )
        }
        if (!adding) {
            Spacer(Modifier.height(8.dp))
            LombadaButton("Sair da conta", onClick = onSignOut, style = LombadaButtonStyle.Text)
        }
        Spacer(Modifier.height(40.dp))
    }
}

@Composable
private fun OnboardingCard(content: @Composable () -> Unit) {
    Column(
        verticalArrangement = Arrangement.spacedBy(10.dp),
        modifier =
            Modifier
                .fillMaxWidth()
                .background(LombadaColors.Shelf, MaterialTheme.shapes.large)
                .padding(16.dp)
    ) { content() }
}

@Composable
private fun CardTitle(text: String) {
    Text(text, style = MaterialTheme.typography.titleMedium, modifier = Modifier.semantics { heading() })
}
