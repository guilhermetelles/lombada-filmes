package io.github.guilhermetelles.lombada.ui.theme

import androidx.compose.foundation.text.selection.LocalTextSelectionColors
import androidx.compose.foundation.text.selection.TextSelectionColors
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider

private val StickerSelection =
    TextSelectionColors(handleColor = LombadaColors.Sticker, backgroundColor = LombadaColors.Sticker.copy(alpha = 0.4f))

/**
 * Tema do Lombada: Material 3 com a paleta, a Barlow e os raios do DESIGN.md. Tema único escuro.
 *
 * @param content Conteúdo da tela.
 */
@Composable
fun LombadaTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = LombadaColorScheme, typography = LombadaTypography, shapes = LombadaShapes) {
        // Texto fora de uma Surface também sai em --paper, e não no preto padrão do Compose.
        CompositionLocalProvider(
            LocalContentColor provides LombadaColors.Paper,
            LocalTextSelectionColors provides StickerSelection,
            content = content
        )
    }
}
