package io.github.guilhermetelles.lombada.ui.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import io.github.guilhermetelles.lombada.data.model.MovieTrailer
import io.github.guilhermetelles.lombada.domain.TrailerLines
import io.github.guilhermetelles.lombada.ui.components.TmdbImages
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/** Quanto o pôster e o título sobem por cima da imagem horizontal, como no mock. */
private val BACKDROP_OVERLAP = 88.dp

/**
 * Topo da página do filme: a imagem horizontal (16:9) some num degradê para o fundo, e o conteúdo
 * (pôster e título) sobe [BACKDROP_OVERLAP] por cima dela. Sem imagem, só o conteúdo.
 *
 * @param backdropPath `backdropPath` do filme, ou null.
 * @param content Pôster, título e fatos do filme.
 */
@Composable
fun BackdropHeader(backdropPath: String?, content: @Composable () -> Unit) {
    val url = TmdbImages.backdrop(backdropPath)
    if (url == null) {
        content()
        return
    }
    BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
        val imageHeight: Dp = maxWidth * 9 / 16
        Box(modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f)) {
            // Decorativa: o título vem logo embaixo.
            AsyncImage(
                url,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                0f to Color.Transparent,
                                0.55f to LombadaColors.Ground.copy(alpha = 0.35f),
                                1f to LombadaColors.Ground
                            )
                        )
            )
        }
        Box(modifier = Modifier.padding(top = imageHeight - BACKDROP_OVERLAP)) { content() }
    }
}

/**
 * Bloco "Trailer": a miniatura do vídeo com o botão de tocar, o nome, o site, o idioma e a data. O
 * bloco inteiro abre o vídeo no YouTube (no app do YouTube, quando instalado).
 *
 * @param trailer Trailer do filme.
 * @param onOpen Abre um endereço fora do app.
 */
@Composable
fun TrailerSection(trailer: MovieTrailer, onOpen: (String) -> Unit) {
    val label = TrailerLines.accessibilityLabel(trailer)
    Column(modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 24.dp)) {
        SectionTitle("Trailer", Modifier.padding(bottom = 8.dp))
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(MaterialTheme.shapes.medium)
                    .background(LombadaColors.Shelf)
                    .clickable { onOpen(MovieLinks.youtube(trailer.key)) }
                    .clearAndSetSemantics {
                        contentDescription = label
                        role = Role.Button
                    }
        ) {
            Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f)) {
                // A miniatura vem em 4:3 com faixas pretas; o recorte no centro tira as faixas.
                AsyncImage(
                    MovieLinks.youtubeThumbnail(trailer.key),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize().background(LombadaColors.ShelfHigh)
                )
                Box(
                    contentAlignment = Alignment.Center,
                    modifier =
                        Modifier
                            .size(56.dp)
                            .clip(CircleShape)
                            .background(LombadaColors.Ground.copy(alpha = 0.72f))
                ) {
                    Icon(
                        Icons.Filled.PlayArrow,
                        contentDescription = null,
                        tint = LombadaColors.Sticker,
                        modifier = Modifier.size(32.dp)
                    )
                }
            }
            Column(modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 14.dp)) {
                if (trailer.name.isNotBlank()) {
                    Text(trailer.name, style = MaterialTheme.typography.titleSmall, color = LombadaColors.Paper)
                }
                Text(
                    TrailerLines.meta(trailer),
                    style = MaterialTheme.typography.bodySmall,
                    color = LombadaColors.Paper3,
                    modifier = Modifier.padding(top = 2.dp)
                )
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
                    Text("Ver no YouTube", style = MaterialTheme.typography.labelMedium, color = LombadaColors.Sticker)
                    Icon(
                        Icons.AutoMirrored.Filled.OpenInNew,
                        contentDescription = null,
                        tint = LombadaColors.Sticker,
                        modifier = Modifier.padding(start = 4.dp).size(16.dp)
                    )
                }
            }
        }
    }
}
