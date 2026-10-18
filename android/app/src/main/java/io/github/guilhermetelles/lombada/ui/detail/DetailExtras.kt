package io.github.guilhermetelles.lombada.ui.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.guilhermetelles.lombada.data.model.Compat
import io.github.guilhermetelles.lombada.domain.CurioRow
import io.github.guilhermetelles.lombada.domain.Curiosities
import io.github.guilhermetelles.lombada.domain.SimilarFilm
import io.github.guilhermetelles.lombada.ui.components.LombadaButton
import io.github.guilhermetelles.lombada.ui.components.LombadaButtonStyle
import io.github.guilhermetelles.lombada.ui.components.MovieCover
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

// Acima disso, "Filmes parecidos" ganha "Ver todos (N)".
private const val SIMILAR_ROW_LIMIT = 3

/**
 * Compatibilidade com vocês, no lugar da posição e da nota, para filme fora da lista: medidor,
 * porcentagem e o motivo. Sem cálculo do backend (lista nova, sem rede), só diz que o filme não
 * está na lista.
 *
 * @param compat Compatibilidade, se o backend calculou.
 * @param loading Se o backend ainda está respondendo.
 */
@Composable
fun CompatBlock(compat: Compat?, loading: Boolean) {
    Column(modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 24.dp).fillMaxWidth()) {
        if (compat != null) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier =
                    Modifier.clearAndSetSemantics {
                        contentDescription = "Compatibilidade com vocês: ${compat.score}%"
                    }
            ) {
                Text(
                    "Compatibilidade com vocês",
                    style = MaterialTheme.typography.labelLarge,
                    color = LombadaColors.Paper2
                )
                Box(
                    modifier =
                        Modifier
                            .weight(1f)
                            .height(8.dp)
                            .background(LombadaColors.ShelfHigh, MaterialTheme.shapes.small)
                ) {
                    Box(
                        Modifier
                            .fillMaxWidth(compat.score / 100f)
                            .fillMaxHeight()
                            .background(LombadaColors.Sticker, MaterialTheme.shapes.small)
                    )
                }
                Text(
                    "${compat.score}%",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.ExtraBold),
                    color = LombadaColors.Sticker
                )
            }
        }
        val why =
            when {
                compat != null && compat.reason.isNotBlank() ->
                    "Por quê: ${compat.reason.trim().trimEnd('.')}. Ainda não está na lista de vocês."

                compat == null && loading -> "Calculando a compatibilidade com vocês…"

                else -> "Ainda não está na lista de vocês."
            }
        Text(
            why,
            style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 21.sp),
            color = LombadaColors.Paper2,
            modifier = Modifier.padding(top = if (compat != null) 8.dp else 0.dp)
        )
    }
}

/**
 * Seção "Curiosidades": slogan, título no Brasil, dinheiro, bilheteria nos EUA, classificação,
 * saga e onde ver no Brasil. Sem nada disso, não aparece.
 *
 * @param curiosities Curiosidades montadas a partir do filme.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CuriositiesSection(curiosities: Curiosities) {
    if (curiosities.isEmpty) return
    Column(modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 24.dp)) {
        SectionTitle("Curiosidades", Modifier.padding(bottom = 10.dp))
        curiosities.tagline?.let {
            Text(
                "“$it”",
                style = MaterialTheme.typography.bodyLarge.copy(fontStyle = FontStyle.Italic, lineHeight = 24.sp),
                color = LombadaColors.Paper,
                modifier = Modifier.padding(bottom = 12.dp)
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            curiosities.rows.forEach { CurioLine(it) }
            if (curiosities.providers.isNotEmpty()) {
                CurioLabelled("Onde ver no Brasil") {
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        curiosities.providers.forEach { ProviderChip(it) }
                    }
                }
            }
        }
        Text(
            "Dados do TMDb e da OMDb; onde ver, pelo TMDb (JustWatch).",
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.5.sp, lineHeight = 19.sp),
            color = LombadaColors.Paper3,
            modifier = Modifier.padding(top = 12.dp)
        )
    }
}

/**
 * Selo de um serviço de streaming.
 *
 * @param name Nome do serviço.
 */
@Composable
fun ProviderChip(name: String) {
    Text(
        name,
        style = MaterialTheme.typography.labelMedium,
        color = LombadaColors.Paper,
        modifier =
            Modifier
                .background(LombadaColors.ShelfHigh, MaterialTheme.shapes.small)
                .padding(horizontal = 10.dp, vertical = 5.dp)
    )
}

@Composable
private fun CurioLine(row: CurioRow) {
    CurioLabelled(row.label) {
        val text =
            buildAnnotatedString {
                row.parts.forEach { part ->
                    if (part.strong) {
                        withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = LombadaColors.Paper)) {
                            append(part.text)
                        }
                    } else {
                        append(part.text)
                    }
                }
            }
        Text(text, style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 21.sp), color = LombadaColors.Paper2)
    }
}

@Composable
private fun CurioLabelled(label: String, content: @Composable () -> Unit) {
    Row(modifier = Modifier.fillMaxWidth().semantics(mergeDescendants = true) {}) {
        Text(
            label,
            style = MaterialTheme.typography.labelMedium.copy(lineHeight = 21.sp),
            color = LombadaColors.Paper3,
            modifier = Modifier.width(112.dp).padding(end = 8.dp)
        )
        Box(Modifier.weight(1f)) { content() }
    }
}

/**
 * Seção "Filmes parecidos": recomendações do TMDb numa fileira, primeiro os da lista (pela
 * posição), depois os de fora (pela compatibilidade); "Ver todos (N)" abre em grade.
 *
 * @param films Cards, já na ordem.
 * @param onOpen Abre a página do filme.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SimilarSection(films: List<SimilarFilm>, onOpen: (SimilarFilm) -> Unit) {
    if (films.isEmpty()) return
    var expanded by rememberSaveable { mutableStateOf(false) }
    val anyInList = films.any { it.position != null }
    Column(modifier = Modifier.padding(top = 24.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(start = 20.dp, end = 8.dp)
        ) {
            SectionTitle("Filmes parecidos", Modifier.weight(1f))
            if (films.size > SIMILAR_ROW_LIMIT) {
                LombadaButton(
                    if (expanded) "Mostrar menos" else "Ver todos (${films.size})",
                    onClick = { expanded = !expanded },
                    style = LombadaButtonStyle.Text
                )
            }
        }
        Text(
            "Recomendações do TMDb para quem viu este filme. " +
                if (anyInList) {
                    "Primeiro os que já estão na lista, pela posição; depois pela compatibilidade com o gosto de vocês."
                } else {
                    "Ordenados pela compatibilidade com o gosto de vocês."
                },
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp, lineHeight = 19.sp),
            color = LombadaColors.Paper3,
            modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 10.dp)
        )
        if (expanded) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
                modifier = Modifier.padding(horizontal = 20.dp)
            ) { films.forEach { SimilarCard(it, onOpen) } }
        } else {
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(horizontal = 20.dp)
            ) {
                items(films, key = { it.tmdbId }) { SimilarCard(it, onOpen) }
            }
        }
    }
}

@Composable
private fun SimilarCard(film: SimilarFilm, onOpen: (SimilarFilm) -> Unit) {
    val note =
        when {
            film.position != null -> "#${film.position} na lista"
            film.score != null -> "${film.score}% compatível"
            else -> null
        }
    Column(
        verticalArrangement = Arrangement.spacedBy(4.dp),
        modifier =
            Modifier
                .width(96.dp)
                .clickable(role = Role.Button, onClickLabel = "Abrir ${film.title}") { onOpen(film) }
                .semantics(mergeDescendants = true) {
                    contentDescription = listOfNotNull(film.title, film.year?.toString(), note).joinToString(", ")
                }
    ) {
        MovieCover(film.title, film.posterPath, film.tmdbId, Modifier.fillMaxWidth(), initialsSize = 16.sp)
        Text(
            film.title,
            style = MaterialTheme.typography.labelMedium.copy(lineHeight = 16.sp),
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
        note?.let {
            Text(
                it,
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.5.sp),
                color = if (film.position != null) LombadaColors.Sticker else LombadaColors.Paper3
            )
        }
    }
}
