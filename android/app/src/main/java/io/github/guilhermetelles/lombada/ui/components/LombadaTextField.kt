package io.github.guilhermetelles.lombada.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.error
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/**
 * Campo do mock: rótulo em cima, borda `--rule` que vira amarela no foco e vermelha no erro, e a
 * mensagem de erro embaixo.
 *
 * @param value Texto atual.
 * @param onValueChange Novo texto.
 * @param label Rótulo acima do campo.
 * @param modifier Modificador do Compose.
 * @param placeholder Exemplo mostrado com o campo vazio.
 * @param error Mensagem de erro, ou null.
 * @param optional Se mostra "(opcional)" ao lado do rótulo.
 * @param singleLine Se é campo de uma linha.
 * @param minLines Linhas mínimas, para comentários.
 * @param keyboardOptions Teclado.
 * @param keyboardActions Ação do teclado.
 * @param textStyle Estilo do texto digitado.
 * @param visualTransformation Formatação só visual, como o traço do código.
 */
@Composable
fun LombadaTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    error: String? = null,
    optional: Boolean = false,
    singleLine: Boolean = true,
    minLines: Int = 1,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    textStyle: TextStyle = MaterialTheme.typography.bodyLarge,
    visualTransformation: VisualTransformation = VisualTransformation.None
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            text =
                buildAnnotatedString {
                    append(label)
                    if (optional) {
                        withStyle(
                            MaterialTheme.typography.labelMedium.toSpanStyle().copy(
                                fontWeight = FontWeight.Normal,
                                color = LombadaColors.Paper3
                            )
                        ) {
                            append(" (opcional)")
                        }
                    }
                },
            style = MaterialTheme.typography.labelMedium,
            color = LombadaColors.Paper2
        )
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 52.dp)
                    .semantics { if (error != null) error(error) },
            textStyle = textStyle,
            placeholder = placeholder?.let { { Text(it, style = textStyle, color = LombadaColors.Paper3) } },
            isError = error != null,
            singleLine = singleLine,
            minLines = minLines,
            keyboardOptions = keyboardOptions,
            keyboardActions = keyboardActions,
            visualTransformation = visualTransformation,
            shape = RoundedCornerShape(8.dp),
            colors =
                OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = LombadaColors.Ground,
                    unfocusedContainerColor = LombadaColors.Ground,
                    errorContainerColor = LombadaColors.Ground,
                    focusedBorderColor = LombadaColors.Sticker,
                    unfocusedBorderColor = LombadaColors.Rule,
                    errorBorderColor = LombadaColors.Error,
                    cursorColor = LombadaColors.Sticker,
                    errorCursorColor = LombadaColors.Error,
                    focusedTextColor = LombadaColors.Paper,
                    unfocusedTextColor = LombadaColors.Paper,
                    errorTextColor = LombadaColors.Paper
                )
        )
        if (error != null) {
            Text(
                error,
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.5.sp),
                color = LombadaColors.Error
            )
        }
    }
}
