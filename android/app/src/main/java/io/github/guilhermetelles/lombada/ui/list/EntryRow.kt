package io.github.guilhermetelles.lombada.ui.list

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DragHandle
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.domain.CoupleScore
import io.github.guilhermetelles.lombada.domain.Formatting
import io.github.guilhermetelles.lombada.ui.components.MovieCover
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import io.github.guilhermetelles.lombada.ui.theme.RankSticker

/**
 * Item da lista, a "fita": capa com a etiqueta de posição, título e ano, data, notas, comentário
 * em 3 linhas e a coluna de ações (editar e alça de arrasto).
 *
 * @param entry Entrada.
 * @param position Posição no ranking.
 * @param total Quantidade de filmes, para a nota de vocês.
 * @param expanded Se o comentário está aberto.
 * @param onToggleExpanded Abre ou fecha o comentário.
 * @param onOpen Abre o detalhe do filme.
 * @param onEdit Abre a folha de edição.
 * @param dragHandle Alça de arrasto, ou null quando arrastar está desligado.
 * @param modifier Modificador do Compose.
 * @param onMove Move a entrada por um número de posições, para o leitor de tela; null sem arrastar.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun EntryRow(
    entry: Entry,
    position: Int,
    total: Int,
    expanded: Boolean,
    onToggleExpanded: () -> Unit,
    onOpen: () -> Unit,
    onEdit: () -> Unit,
    dragHandle: (@Composable () -> Unit)?,
    modifier: Modifier = Modifier,
    onMove: ((Int) -> Unit)? = null
) {
    val movie = entry.movie
    Column(modifier = modifier.background(LombadaColors.Ground)) {
        HorizontalDivider(color = LombadaColors.Rule)
        Row(
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(onClickLabel = "Abrir ${movie.title}", role = Role.Button, onClick = onOpen)
                    .semantics {
                        // Quem usa leitor de tela não arrasta: mover fica nas ações do item.
                        if (onMove != null) {
                            customActions =
                                listOfNotNull(
                                    if (position >
                                        1
                                    ) {
                                        CustomAccessibilityAction("Mover para cima") {
                                            onMove(-1)
                                            true
                                        }
                                    } else {
                                        null
                                    },
                                    if (position <
                                        total
                                    ) {
                                        CustomAccessibilityAction("Mover para baixo") {
                                            onMove(1)
                                            true
                                        }
                                    } else {
                                        null
                                    }
                                )
                        }
                    }
                    .padding(start = 20.dp, end = 4.dp, top = 16.dp, bottom = 18.dp)
        ) {
            Box(modifier = Modifier.width(68.dp)) {
                MovieCover(movie.title, movie.posterPath, entry.tmdbId, Modifier.fillMaxWidth())
                RankSticker(position = position, id = entry.id, modifier = Modifier.offset((-9).dp, (-9).dp))
            }
            Column(verticalArrangement = Arrangement.spacedBy(5.dp), modifier = Modifier.weight(1f)) {
                Text(
                    buildAnnotatedString {
                        append(movie.title)
                        movie.year?.let { year ->
                            withStyle(
                                SpanStyle(
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = LombadaColors.Paper3
                                )
                            ) {
                                append("  $year")
                            }
                        }
                    },
                    style = MaterialTheme.typography.titleMedium.copy(fontSize = 18.sp, lineHeight = 22.sp),
                    modifier = Modifier.padding(top = 3.dp)
                )
                Text(
                    Formatting.seenLine(entry.watchedOn),
                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.5.sp),
                    color = LombadaColors.Paper2
                )
                RatesLine(score = CoupleScore.of(position, total), imdb = movie.imdb, letterboxd = movie.letterboxd)
                CommentBlock(entry.comment, expanded, onToggleExpanded)
            }
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                IconButton(onClick = onEdit, modifier = Modifier.size(40.dp, 48.dp)) {
                    Icon(
                        Icons.Filled.Edit,
                        contentDescription = "Editar registro de ${movie.title}",
                        tint = LombadaColors.Paper2
                    )
                }
                Box(Modifier.size(40.dp, 48.dp), contentAlignment = Alignment.Center) { dragHandle?.invoke() }
            }
        }
    }
}

/**
 * Ícone da alça de arrasto, para o modificador de arrasto da lista.
 *
 * @param title Título do filme, para o leitor de tela.
 * @param modifier Modificador com o gesto de arrastar.
 */
@Composable
fun DragHandleIcon(title: String, modifier: Modifier = Modifier) {
    Box(modifier = modifier.size(40.dp, 48.dp), contentAlignment = Alignment.Center) {
        Icon(
            Icons.Filled.DragHandle,
            contentDescription = "Arrastar $title para outra posição",
            tint = LombadaColors.Paper3
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RatesLine(score: Double, imdb: Double?, letterboxd: Double?) {
    val style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp)
    val bold = SpanStyle(fontWeight = FontWeight.SemiBold, color = LombadaColors.Paper)
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            buildAnnotatedString {
                append("Vocês ")
                withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(Formatting.oneDecimal(score)) }
                append("/10")
            },
            style = style,
            color = LombadaColors.Sticker
        )
        FlowRow(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                buildAnnotatedString {
                    append("IMDb ")
                    withStyle(bold) { append(Formatting.oneDecimal(imdb)) }
                    append("/10")
                },
                style = style,
                color = LombadaColors.Paper3
            )
            Text(
                buildAnnotatedString {
                    append("Letterboxd ")
                    withStyle(bold) { append(Formatting.oneDecimal(letterboxd)) }
                    append("/5")
                },
                style = style,
                color = LombadaColors.Paper3
            )
        }
    }
}

@Composable
private fun CommentBlock(comment: String, expanded: Boolean, onToggleExpanded: () -> Unit) {
    val style = MaterialTheme.typography.bodyLarge.copy(fontSize = 15.sp, lineHeight = 22.5.sp)
    if (comment.isBlank()) {
        Text(
            "Sem comentário ainda",
            style = style.copy(fontStyle = FontStyle.Italic),
            color = LombadaColors.Paper3,
            modifier = Modifier.padding(top = 1.dp)
        )
        return
    }
    var overflows by remember(comment) { mutableStateOf(false) }
    Text(
        comment,
        style = style,
        maxLines = if (expanded) Int.MAX_VALUE else 3,
        onTextLayout = { if (!expanded) overflows = it.hasVisualOverflow },
        modifier = Modifier.padding(top = 1.dp)
    )
    if (overflows || expanded) {
        TextButton(
            onClick = onToggleExpanded,
            modifier =
                Modifier
                    .offset(x = (-12).dp)
                    .semantics { stateDescription = if (expanded) "Comentário aberto" else "Comentário recolhido" }
        ) {
            Text(
                if (expanded) "Mostrar menos" else "Ler comentário completo",
                style = MaterialTheme.typography.labelLarge.copy(fontSize = 14.sp),
                color = LombadaColors.Sticker
            )
        }
    }
}
