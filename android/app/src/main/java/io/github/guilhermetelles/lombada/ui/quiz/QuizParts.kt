package io.github.guilhermetelles.lombada.ui.quiz

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import io.github.guilhermetelles.lombada.data.model.MovieList
import io.github.guilhermetelles.lombada.data.model.PosterCrop
import io.github.guilhermetelles.lombada.domain.ScoreRow
import io.github.guilhermetelles.lombada.ui.components.TmdbImages
import io.github.guilhermetelles.lombada.ui.components.initialsOf
import io.github.guilhermetelles.lombada.ui.feed.MemberAvatar
import io.github.guilhermetelles.lombada.ui.feed.memberProfile
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/** Como uma alternativa aparece depois de responder. */
enum class OptionLook {
    /** Antes de responder, ou uma alternativa que ninguém escolheu. */
    Idle,

    /** A certa, que a pessoa não escolheu. */
    Right,

    /** A escolhida, e certa. */
    MineRight,

    /** A escolhida, e errada. */
    MineWrong
}

/**
 * Alternativa grande (56dp ou mais), com o resultado dito em texto e ícone, não só pela cor.
 *
 * @param label Texto.
 * @param imageUrl Foto, nas perguntas de personagem.
 * @param look Resultado.
 * @param enabled Se aceita toque.
 * @param sending Se esta alternativa está sendo enviada.
 * @param onClick Responde com esta alternativa.
 */
@Composable
fun QuizOptionButton(
    label: String,
    imageUrl: String?,
    look: OptionLook,
    enabled: Boolean,
    sending: Boolean,
    onClick: () -> Unit
) {
    val (border, container) =
        when (look) {
            OptionLook.Idle -> LombadaColors.Rule to LombadaColors.Shelf
            OptionLook.Right, OptionLook.MineRight -> LombadaColors.Sticker to LombadaColors.Sticker.copy(alpha = 0.14f)
            OptionLook.MineWrong -> LombadaColors.Error to LombadaColors.Error.copy(alpha = 0.12f)
        }
    val tag =
        when (look) {
            OptionLook.Idle -> null
            OptionLook.Right -> "Certa"
            OptionLook.MineRight -> "Sua resposta, certa"
            OptionLook.MineWrong -> "Sua resposta"
        }
    Surface(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(16.dp),
        color = container,
        contentColor = LombadaColors.Paper,
        border = BorderStroke(if (look == OptionLook.Idle) 1.dp else 2.dp, border),
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .semantics {
                    role = Role.Button
                    if (tag != null) stateDescription = tag
                }
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp)
        ) {
            if (imageUrl != null) {
                OptionPhoto(label, imageUrl)
                Box(Modifier.width(12.dp))
            }
            Text(
                label,
                style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.SemiBold),
                modifier = Modifier.weight(1f)
            )
            when {
                sending ->
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp,
                        color = LombadaColors.Sticker
                    )

                tag != null -> ResultTag(tag, right = look != OptionLook.MineWrong)
            }
        }
    }
}

@Composable
private fun ResultTag(text: String, right: Boolean) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(start = 8.dp).clearAndSetSemantics {}
    ) {
        Icon(
            if (right) Icons.Filled.Check else Icons.Filled.Close,
            contentDescription = null,
            tint = if (right) LombadaColors.Sticker else LombadaColors.Error,
            modifier = Modifier.size(18.dp)
        )
        Text(
            text,
            style = MaterialTheme.typography.labelMedium,
            color = if (right) LombadaColors.Sticker else LombadaColors.Error,
            modifier = Modifier.padding(start = 4.dp)
        )
    }
}

@Composable
private fun OptionPhoto(name: String, imageUrl: String) {
    val url = if (imageUrl.startsWith("http")) imageUrl else TmdbImages.profile(imageUrl)
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(LombadaColors.ShelfHigh)
                .clearAndSetSemantics {}
    ) {
        Text(initialsOf(name), style = MaterialTheme.typography.labelMedium, color = LombadaColors.Paper2)
        AsyncImage(url, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
    }
}

/**
 * Pôster recortado bem de perto, como o backend pediu no `crop`: o ponto (x, y) fica no centro,
 * ampliado `zoom` vezes, sem deixar borda vazia.
 *
 * @param posterPath Pôster do TMDb.
 * @param crop Recorte.
 * @param modifier Modificador do Compose; define a largura.
 */
@Composable
fun CroppedPoster(posterPath: String, crop: PosterCrop, modifier: Modifier = Modifier) {
    BoxWithConstraints(
        modifier =
            modifier
                .aspectRatio(2f / 3f)
                .clip(MaterialTheme.shapes.medium)
                .background(LombadaColors.Shelf)
                .clearAndSetSemantics { contentDescription = "Recorte ampliado de um pôster" }
    ) {
        val zoom = crop.zoom.toFloat().coerceAtLeast(1f)
        val width = constraints.maxWidth.toFloat()
        val height = constraints.maxHeight.toFloat()
        val maxX = (zoom - 1f) / 2f * width
        val maxY = (zoom - 1f) / 2f * height
        val shiftX = ((0.5f - crop.x.toFloat()) * width * zoom).coerceIn(-maxX, maxX)
        val shiftY = ((0.5f - crop.y.toFloat()) * height * zoom).coerceIn(-maxY, maxY)
        AsyncImage(
            model = largePoster(posterPath),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier =
                Modifier
                    .fillMaxSize()
                    .graphicsLayer {
                        scaleX = zoom
                        scaleY = zoom
                        translationX = shiftX
                        translationY = shiftY
                    }
        )
    }
}

/**
 * Pôster inteiro, mostrado depois de responder a pergunta de pôster.
 *
 * @param posterPath Pôster do TMDb.
 * @param modifier Modificador do Compose; define a largura.
 */
@Composable
fun FullPoster(posterPath: String, modifier: Modifier = Modifier) {
    AsyncImage(
        model = largePoster(posterPath),
        contentDescription = "O pôster inteiro",
        contentScale = ContentScale.Crop,
        modifier =
            modifier
                .aspectRatio(2f / 3f)
                .clip(MaterialTheme.shapes.medium)
                .background(LombadaColors.Shelf)
    )
}

// Maior que o da lista: o recorte amplia a imagem.
private fun largePoster(path: String) = "https://image.tmdb.org/t/p/w780$path"

/**
 * Citação em bloco, com a faixa amarela à esquerda: trechos verbatim e sinopses.
 *
 * @param text Texto.
 * @param modifier Modificador do Compose.
 */
@Composable
fun QuoteBlock(text: String, modifier: Modifier = Modifier) {
    Row(modifier = modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
        Box(
            Modifier
                .width(3.dp)
                .fillMaxHeight()
                .background(LombadaColors.Sticker)
        )
        Text(
            text,
            style = MaterialTheme.typography.bodyLarge.copy(lineHeight = 24.sp),
            color = LombadaColors.Paper,
            modifier = Modifier.padding(start = 14.dp)
        )
    }
}

/**
 * "acertou" ou "errou" com ícone, para não depender só da cor.
 *
 * @param correct Se acertou.
 */
@Composable
fun ResultMark(correct: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(
            if (correct) Icons.Filled.Check else Icons.Filled.Close,
            contentDescription = null,
            tint = if (correct) LombadaColors.Sticker else LombadaColors.Error,
            modifier = Modifier.size(16.dp)
        )
        Text(
            if (correct) "acertou" else "errou",
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
            color = if (correct) LombadaColors.Sticker else LombadaColors.Error,
            modifier = Modifier.padding(start = 3.dp)
        )
    }
}

/**
 * Linhas do placar: foto, nome ("você" na pessoa logada), barra amarela proporcional e os pontos.
 *
 * @param rows Linhas, já ordenadas.
 * @param list Lista, para nome e foto de cada membro.
 */
@Composable
fun ScoreBoard(rows: List<ScoreRow>, list: MovieList) {
    val top = rows.maxOfOrNull { it.points }?.coerceAtLeast(1) ?: 1
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        rows.forEach { row ->
            val profile = memberProfile(list, row.uid)
            val name = if (row.isMe) "${profile.name} (você)" else profile.name
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clearAndSetSemantics { contentDescription = "$name: ${pointsLabel(row.points)}" }
            ) {
                MemberAvatar(profile.name, profile.photoUrl, 32.dp)
                Text(
                    name,
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 1,
                    modifier = Modifier.padding(start = 10.dp).widthIn(max = 140.dp)
                )
                Box(
                    Modifier
                        .padding(horizontal = 10.dp)
                        .weight(1f)
                        .height(8.dp)
                        .clip(CircleShape)
                        .background(LombadaColors.Ground)
                ) {
                    Box(
                        Modifier
                            .fillMaxWidth(row.points.toFloat() / top)
                            .fillMaxHeight()
                            .background(LombadaColors.Sticker)
                    )
                }
                Text(row.points.toString(), style = MaterialTheme.typography.titleMedium)
            }
        }
    }
}

/**
 * Pontos com o nome no singular ou plural.
 *
 * @param points Pontos.
 * @return Por exemplo "1 ponto" ou "30 pontos".
 */
fun pointsLabel(points: Int): String = if (points == 1) "1 ponto" else "$points pontos"
