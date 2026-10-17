package io.github.guilhermetelles.lombada.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import io.github.guilhermetelles.lombada.ui.theme.Barlow
import kotlin.math.absoluteValue

/** Endereços das imagens do TMDb, que o app carrega direto, sem passar pelo backend. */
object TmdbImages {
    /**
     * Capa no tamanho da lista e do detalhe.
     *
     * @param path `posterPath` do filme.
     * @return URL da imagem, ou null sem capa.
     */
    fun poster(path: String?): String? = path?.let { "https://image.tmdb.org/t/p/w342$it" }

    /**
     * Foto de pessoa.
     *
     * @param path `profilePath` da pessoa.
     * @return URL da imagem, ou null sem foto.
     */
    fun profile(path: String?): String? = path?.let { "https://image.tmdb.org/t/p/w185$it" }
}

/**
 * Iniciais de um título ou nome, para o placeholder.
 *
 * @param text Título ou nome.
 * @return Até duas letras maiúsculas.
 */
fun initialsOf(text: String): String = text
    .removePrefix("The ")
    .split(Regex("[\\s:-]+"))
    .filter { it.firstOrNull()?.isLetterOrDigit() == true }
    .take(2)
    .joinToString("") { it.first().uppercase() }

/**
 * Capa 2:3 do filme. Enquanto a imagem não chega (ou sem capa), mostra o placeholder do mock: um
 * gradiente com a cor tirada do id e as iniciais do título.
 *
 * @param title Título, para as iniciais.
 * @param posterPath Caminho da capa no TMDb.
 * @param seed Número estável que escolhe a cor do placeholder (o tmdbId).
 * @param modifier Modificador do Compose; define a largura.
 * @param initialsSize Tamanho das iniciais.
 */
@Composable
fun MovieCover(
    title: String,
    posterPath: String?,
    seed: Int,
    modifier: Modifier = Modifier,
    initialsSize: TextUnit = 19.sp
) {
    val brush = remember(seed) { placeholderBrush(seed) }
    val shape = RoundedCornerShape(4.dp)
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            modifier
                .aspectRatio(2f / 3f)
                .shadow(2.dp, shape)
                .clip(shape)
                .background(brush)
                // Capa decorativa: o título já está ao lado; as iniciais não devem ser lidas.
                .clearAndSetSemantics {}
    ) {
        Text(
            initialsOf(title),
            style =
                TextStyle(
                    fontFamily = Barlow,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = initialsSize,
                    color = Color.White.copy(alpha = 0.94f),
                    shadow = Shadow(Color.Black.copy(alpha = 0.45f), Offset(0f, 2f), 10f)
                )
        )
        if (posterPath != null) {
            AsyncImage(
                model = TmdbImages.poster(posterPath),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
        }
    }
}

private fun placeholderBrush(seed: Int): Brush {
    val hue = ((seed.toLong() * 137).absoluteValue % 360).toFloat()
    return Brush.linearGradient(
        0f to Color.hsv(hue, 0.6f, 0.72f),
        0.55f to Color.hsv(hue, 0.75f, 0.39f),
        1f to Color.hsv(hue, 0.8f, 0.12f),
        start = Offset(0f, 0f),
        end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY)
    )
}
