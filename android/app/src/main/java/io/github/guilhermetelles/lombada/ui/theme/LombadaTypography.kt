package io.github.guilhermetelles.lombada.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import io.github.guilhermetelles.lombada.R

/** Barlow numa família só, embutida no app para funcionar sem internet. */
val Barlow =
    FontFamily(
        Font(R.font.barlow_regular, FontWeight.Normal),
        Font(R.font.barlow_medium, FontWeight.Medium),
        Font(R.font.barlow_semibold, FontWeight.SemiBold),
        Font(R.font.barlow_bold, FontWeight.Bold),
        Font(R.font.barlow_extrabold, FontWeight.ExtraBold)
    )

private fun barlow(weight: FontWeight, size: Int, lineHeight: Int): TextStyle =
    TextStyle(fontFamily = Barlow, fontWeight = weight, fontSize = size.sp, lineHeight = lineHeight.sp)

/** Escala do Material 3 em Barlow: 700–800 para títulos, 400–600 para corpo, rótulos e botões. */
internal val LombadaTypography =
    Typography(
        displayLarge = barlow(FontWeight.ExtraBold, 48, 52),
        displayMedium = barlow(FontWeight.ExtraBold, 40, 44),
        displaySmall = barlow(FontWeight.ExtraBold, 34, 40),
        headlineLarge = barlow(FontWeight.ExtraBold, 30, 36),
        headlineMedium = barlow(FontWeight.ExtraBold, 26, 32),
        headlineSmall = barlow(FontWeight.Bold, 22, 26),
        titleLarge = barlow(FontWeight.Bold, 20, 24),
        titleMedium = barlow(FontWeight.Bold, 17, 22),
        titleSmall = barlow(FontWeight.SemiBold, 15, 20),
        bodyLarge = barlow(FontWeight.Normal, 16, 23),
        bodyMedium = barlow(FontWeight.Normal, 14, 20),
        bodySmall = barlow(FontWeight.Normal, 13, 18),
        labelLarge = barlow(FontWeight.SemiBold, 15, 20),
        labelMedium = barlow(FontWeight.SemiBold, 13, 16),
        labelSmall = barlow(FontWeight.Medium, 12, 16)
    )
