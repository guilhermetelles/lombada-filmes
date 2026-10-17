package io.github.guilhermetelles.lombada.ui.theme

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import io.github.guilhermetelles.lombada.R

/**
 * Logo do Lombada, a fita VHS de frente. Decorativo: o nome do app vem sempre escrito ao lado.
 *
 * @param modifier Modificador do Compose.
 * @param width Largura; a altura segue a proporção 40×24 do desenho.
 */
@Composable
fun BrandMark(modifier: Modifier = Modifier, width: Dp = 40.dp) {
    Image(
        painter = painterResource(R.drawable.brand_mark),
        contentDescription = null,
        modifier = modifier.size(width, width * 24 / 40)
    )
}
