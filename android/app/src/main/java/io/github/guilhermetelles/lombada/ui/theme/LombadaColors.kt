package io.github.guilhermetelles.lombada.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.ui.graphics.Color

/** Paleta do DESIGN.md: a prateleira da locadora, à noite. Tema único escuro. */
object LombadaColors {
    /** Chão das telas, azul-noite de vitrine. */
    val Ground = Color(0xFF121433)

    /** Superfície: bottom sheet e cards de nota. */
    val Shelf = Color(0xFF1B1E47)

    /** Superfície elevada: barra de busca. */
    val ShelfHigh = Color(0xFF262A5C)

    /** Barra de busca com foco. */
    val ShelfFocus = Color(0xFF2D3268)

    /** Divisórias da prateleira, bordas de campo e chip. */
    val Rule = Color(0xFF2F3470)

    /** Texto principal, o papel da ficha de aluguel. */
    val Paper = Color(0xFFF3EFE4)

    /** Texto secundário. */
    val Paper2 = Color(0xFFC3C2DD)

    /** Legendas e placeholders. */
    val Paper3 = Color(0xFF9A9BC4)

    /** Etiqueta de posição, foco, links de texto e seleção. */
    val Sticker = Color(0xFFFFD93B)

    /** Texto sobre a etiqueta. */
    val StickerInk = Color(0xFF1F1700)

    /** Ação primária: FAB e botão filled. */
    val PosterOrange = Color(0xFFFF6A3D)

    /** Texto sobre a ação primária. */
    val OnOrange = Color(0xFF2A0C00)

    /** Botão tonal e item ativo. */
    val Tonal = Color(0xFF33386F)

    /** Remover e erro de validação. */
    val Error = Color(0xFFFF8A80)

    /** Fundo de mensagens de erro. */
    val ErrorContainer = Color(0xFF5C1A1A)

    /** Snackbar. */
    val Inverse = Color(0xFFECE9F6)

    /** Texto sobre o snackbar. */
    val OnInverse = Color(0xFF1B1E47)
}

/** Os tokens do Lombada mapeados nos papéis do Material 3. */
internal val LombadaColorScheme: ColorScheme =
    darkColorScheme(
        primary = LombadaColors.PosterOrange,
        onPrimary = LombadaColors.OnOrange,
        primaryContainer = LombadaColors.PosterOrange,
        onPrimaryContainer = LombadaColors.OnOrange,
        secondary = LombadaColors.Sticker,
        onSecondary = LombadaColors.StickerInk,
        secondaryContainer = LombadaColors.Tonal,
        onSecondaryContainer = LombadaColors.Paper,
        tertiary = LombadaColors.Sticker,
        onTertiary = LombadaColors.StickerInk,
        background = LombadaColors.Ground,
        onBackground = LombadaColors.Paper,
        surface = LombadaColors.Ground,
        onSurface = LombadaColors.Paper,
        surfaceVariant = LombadaColors.Shelf,
        onSurfaceVariant = LombadaColors.Paper2,
        surfaceContainerLowest = LombadaColors.Ground,
        surfaceContainerLow = LombadaColors.Shelf,
        surfaceContainer = LombadaColors.Shelf,
        surfaceContainerHigh = LombadaColors.ShelfHigh,
        surfaceContainerHighest = LombadaColors.ShelfHigh,
        surfaceBright = LombadaColors.ShelfHigh,
        surfaceDim = LombadaColors.Ground,
        outline = LombadaColors.Rule,
        outlineVariant = LombadaColors.Rule,
        error = LombadaColors.Error,
        onError = LombadaColors.Ground,
        errorContainer = LombadaColors.ErrorContainer,
        onErrorContainer = LombadaColors.Paper,
        inverseSurface = LombadaColors.Inverse,
        inverseOnSurface = LombadaColors.OnInverse,
        inversePrimary = LombadaColors.PosterOrange,
        scrim = Color.Black
    )
