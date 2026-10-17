package io.github.guilhermetelles.lombada.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

private val ButtonHeight = 48.dp
private val ButtonPadding = PaddingValues(horizontal = 24.dp)

/** Cores e conteúdo de cada estilo de botão do DESIGN.md. */
enum class LombadaButtonStyle {
    /** Ação primária, laranja de cartaz. */
    Filled,

    /** Ação secundária, azul tonal. */
    Tonal,

    /** Link de texto em amarelo. */
    Text,

    /** Remover, contorno vermelho. */
    OutlinedError
}

/**
 * Botão de 48dp nos estilos do mock. Com [busy], mostra um indicador e não aceita toque.
 *
 * @param text Rótulo.
 * @param onClick Ação.
 * @param modifier Modificador do Compose.
 * @param style Estilo visual.
 * @param enabled Se aceita toque.
 * @param busy Se a ação está em andamento.
 */
@Composable
fun LombadaButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    style: LombadaButtonStyle = LombadaButtonStyle.Filled,
    enabled: Boolean = true,
    busy: Boolean = false
) {
    val sized = modifier.heightIn(min = ButtonHeight)
    val content: @Composable RowScope.() -> Unit = {
        if (busy) {
            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = contentColor(style))
        } else {
            Text(text)
        }
    }
    val active = enabled && !busy
    when (style) {
        LombadaButtonStyle.Filled ->
            Button(
                onClick = onClick,
                modifier = sized,
                enabled = active,
                contentPadding = ButtonPadding,
                colors =
                    ButtonDefaults.buttonColors(
                        containerColor = LombadaColors.PosterOrange,
                        contentColor = LombadaColors.OnOrange,
                        disabledContainerColor = LombadaColors.PosterOrange.copy(alpha = if (busy) 1f else 0.38f),
                        disabledContentColor = LombadaColors.OnOrange.copy(alpha = if (busy) 1f else 0.6f)
                    ),
                content = content
            )

        LombadaButtonStyle.Tonal ->
            Button(
                onClick = onClick,
                modifier = sized,
                enabled = active,
                contentPadding = ButtonPadding,
                colors =
                    ButtonDefaults.buttonColors(
                        containerColor = LombadaColors.Tonal,
                        contentColor = LombadaColors.Paper,
                        disabledContainerColor = LombadaColors.Tonal.copy(alpha = if (busy) 1f else 0.5f),
                        disabledContentColor = LombadaColors.Paper.copy(alpha = if (busy) 1f else 0.5f)
                    ),
                content = content
            )

        LombadaButtonStyle.Text ->
            TextButton(
                onClick = onClick,
                modifier = sized,
                enabled = active,
                contentPadding = PaddingValues(horizontal = 16.dp),
                colors = ButtonDefaults.textButtonColors(contentColor = LombadaColors.Sticker),
                content = content
            )

        LombadaButtonStyle.OutlinedError ->
            OutlinedButton(
                onClick = onClick,
                modifier = sized,
                enabled = active,
                contentPadding = ButtonPadding,
                border = BorderStroke(1.dp, LombadaColors.Error.copy(alpha = 0.5f)),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = LombadaColors.Error),
                content = content
            )
    }
}

private fun contentColor(style: LombadaButtonStyle) = when (style) {
    LombadaButtonStyle.Filled -> LombadaColors.OnOrange
    LombadaButtonStyle.Tonal -> LombadaColors.Paper
    LombadaButtonStyle.Text -> LombadaColors.Sticker
    LombadaButtonStyle.OutlinedError -> LombadaColors.Error
}
