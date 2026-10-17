package io.github.guilhermetelles.lombada.ui.theme

import android.provider.Settings
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext

/** Movimento do DESIGN.md. */
object LombadaMotion {
    /** Easing padrão, `cubic-bezier(.2, 0, 0, 1)`. */
    val Easing: Easing = CubicBezierEasing(0.2f, 0f, 0f, 1f)

    /** Duração da animação de "recolar" a etiqueta. */
    const val RESTICK_MS = 420

    /** Subida do bottom sheet. */
    const val SHEET_MS = 340
}

/**
 * Diz se a pessoa ligou "Remover animações" nas configurações do Android.
 *
 * @return true quando a escala de animações do sistema é zero.
 */
@Composable
fun rememberReducedMotion(): Boolean {
    val resolver = LocalContext.current.contentResolver
    return remember(resolver) {
        Settings.Global.getFloat(resolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
}
