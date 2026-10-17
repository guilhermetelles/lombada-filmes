package io.github.guilhermetelles.lombada.ui.theme

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.absoluteValue
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch

/**
 * Inclinação fixa da etiqueta de um item, de -6° a 6°, sempre a mesma para o mesmo id.
 *
 * @param id Id estável do item (o da entrada no Firestore).
 * @return Ângulo em graus.
 */
fun stickerTilt(id: String): Float = ((id.hashCode() * 37L).absoluteValue % 13 - 6).toFloat()

/**
 * Etiqueta amarela de posição no ranking, o gesto assinatura do DESIGN.md. Quando o número muda
 * (reordenar, adicionar, remover), ela é "recolada": entra girada e maior e assenta em 420ms. Com
 * "Remover animações" ligado, a troca é instantânea.
 *
 * @param position Posição no ranking, a partir de 1.
 * @param id Id estável do item, que fixa a inclinação.
 * @param modifier Modificador do Compose.
 * @param size Diâmetro; 34dp na lista, 26dp nas linhas menores.
 * @param stickOnAppear Se cola com animação já na primeira exibição, como numa entrada recém-adicionada.
 */
@Composable
fun RankSticker(
    position: Int,
    id: String,
    modifier: Modifier = Modifier,
    size: Dp = 34.dp,
    stickOnAppear: Boolean = false
) {
    val tilt = remember(id) { stickerTilt(id) }
    val reducedMotion = rememberReducedMotion()
    val rotation = remember(id) { Animatable(0f) }
    val scale = remember(id) { Animatable(1f) }
    val alpha = remember(id) { Animatable(1f) }
    var shownPosition by remember(id) { mutableIntStateOf(if (stickOnAppear) 0 else position) }

    LaunchedEffect(position) {
        // Na primeira exibição a etiqueta já está colada; só anima quando o número muda.
        if (position == shownPosition) return@LaunchedEffect
        shownPosition = position
        if (reducedMotion) return@LaunchedEffect
        val duration = LombadaMotion.RESTICK_MS
        rotation.snapTo(-18f)
        scale.snapTo(1.45f)
        alpha.snapTo(0f)
        coroutineScope {
            launch { rotation.animateTo(0f, tween(duration, easing = LombadaMotion.Easing)) }
            launch { scale.animateTo(1f, tween(duration, easing = LombadaMotion.Easing)) }
            launch { alpha.animateTo(1f, tween(duration * 6 / 10, easing = LinearEasing)) }
        }
    }

    // O número acompanha o tamanho fixo da etiqueta, e não a fonte do sistema: com fonte grande ele
    // sairia do círculo. A posição continua no texto para o leitor de tela.
    val fontSize = with(LocalDensity.current) { (size * if (position > 9) 0.47f else 0.56f).toSp() }
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            modifier
                .graphicsLayer {
                    rotationZ = tilt + rotation.value
                    scaleX = scale.value
                    scaleY = scale.value
                    this.alpha = alpha.value
                }.size(size)
                .shadow(3.dp, CircleShape)
                .background(LombadaColors.Sticker, CircleShape)
                .clearAndSetSemantics { contentDescription = "Posição $position" }
    ) {
        Text(
            text = position.toString(),
            style =
                TextStyle(
                    fontFamily = Barlow,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = fontSize,
                    lineHeight = fontSize,
                    color = LombadaColors.StickerInk,
                    textAlign = TextAlign.Center
                )
        )
    }
}
