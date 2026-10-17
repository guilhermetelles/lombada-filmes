package io.github.guilhermetelles.lombada.ui.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import io.github.guilhermetelles.lombada.data.model.Bechdel
import io.github.guilhermetelles.lombada.data.model.CastMember
import io.github.guilhermetelles.lombada.domain.Formatting
import io.github.guilhermetelles.lombada.domain.Standing
import io.github.guilhermetelles.lombada.ui.components.TmdbImages
import io.github.guilhermetelles.lombada.ui.components.initialsOf
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/**
 * Título de seção do detalhe.
 *
 * @param text Título.
 * @param modifier Modificador do Compose.
 */
@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        style = MaterialTheme.typography.titleMedium.copy(fontSize = 18.sp),
        modifier = modifier.semantics {
            heading()
        }
    )
}

/**
 * Card "nota de vocês, pela posição" com a tabela contra IMDb e Letterboxd.
 *
 * @param standing Comparação calculada.
 */
@Composable
fun StandingCard(standing: Standing) {
    val score = Formatting.oneDecimal(standing.score)
    Column(
        modifier =
            Modifier
                .padding(start = 20.dp, end = 20.dp, top = 22.dp)
                .fillMaxWidth()
                .background(LombadaColors.Shelf, MaterialTheme.shapes.large)
                .padding(16.dp)
    ) {
        Text(
            buildAnnotatedString {
                append(score)
                withStyle(SpanStyle(fontSize = 15.sp, fontWeight = FontWeight.Medium, color = LombadaColors.Paper3)) {
                    append("/10")
                }
            },
            style = MaterialTheme.typography.headlineLarge.copy(
                fontSize = 34.sp,
                fontWeight = FontWeight.Bold,
                lineHeight = 38.sp
            )
        )
        Text(
            "Nota de vocês, pela posição: #${standing.position} de ${standing.total}",
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.5.sp),
            color = LombadaColors.Paper2,
            modifier = Modifier.padding(top = 2.dp, bottom = 14.dp)
        )
        CompareRow("Fonte", null, "Nota", "Dif.", "Posição", header = true)
        CompareRow("Vocês", null, score, "–", "#${standing.position}")
        standing.sources.forEach { source ->
            val suffix = if (source.source.name == "Letterboxd") "/5" else ""
            CompareRow(
                label = source.source.label,
                why = source.why to source.youRankHigher,
                rating = source.rating?.let { Formatting.oneDecimal(it) + suffix } ?: "–",
                difference = source.difference?.let(Standing::signed) ?: "–",
                position = "#${source.position}"
            )
        }
        Text(
            "A nota de vocês vai de 10 (1º lugar) a 1 (último), com o mesmo espaço entre cada posição. " +
                "Dif. é a nota de vocês menos a da fonte; contra o Letterboxd, a de vocês vale " +
                "${Formatting.oneDecimal(standing.score / 2)}/5. Posição é onde o filme ficaria se a lista " +
                "fosse ordenada pela nota daquela fonte.",
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.5.sp, lineHeight = 19.sp),
            color = LombadaColors.Paper3,
            modifier = Modifier.padding(top = 12.dp)
        )
    }
}

@Composable
private fun CompareRow(
    label: String,
    why: Pair<String, Boolean>?,
    rating: String,
    difference: String,
    position: String,
    header: Boolean = false
) {
    val numberStyle =
        if (header) {
            MaterialTheme.typography.labelMedium.copy(fontSize = 12.5.sp, color = LombadaColors.Paper3)
        } else {
            MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold)
        }
    Column {
        if (!header) HorizontalDivider(color = LombadaColors.Rule)
        Row(
            modifier = Modifier.padding(
                vertical = if (header) 0.dp else 9.dp
            ).padding(bottom = if (header) 8.dp else 0.dp)
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(label, style = numberStyle)
                if (why != null) {
                    Text(
                        why.first,
                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.5.sp),
                        color = if (why.second) LombadaColors.Sticker else LombadaColors.Paper2,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
            }
            listOf(rating, difference, position).forEach {
                Text(it, style = numberStyle, textAlign = TextAlign.Center, modifier = Modifier.width(58.dp))
            }
        }
    }
}

/**
 * Card de uma nota externa, com link para a fonte.
 *
 * @param source "Nota no IMDb" e afins.
 * @param value Nota formatada, ou "–".
 * @param unit Unidade ao lado da nota (`/10`, `%`).
 * @param link Texto do link.
 * @param onOpen Abre a página.
 * @param modifier Modificador do Compose.
 */
@Composable
fun ScoreCard(
    source: String,
    value: String,
    unit: String?,
    link: String,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(2.dp),
        modifier =
            modifier
                .background(LombadaColors.Shelf, MaterialTheme.shapes.medium)
                .clickable(role = Role.Button, onClickLabel = link, onClick = onOpen)
                .heightIn(min = 48.dp)
                .padding(start = 14.dp, end = 14.dp, top = 14.dp, bottom = 12.dp)
    ) {
        Text(source, style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp), color = LombadaColors.Paper2)
        Text(
            buildAnnotatedString {
                append(value)
                if (unit != null && value != "–") {
                    withStyle(
                        SpanStyle(fontSize = 15.sp, fontWeight = FontWeight.Medium, color = LombadaColors.Paper3)
                    ) {
                        append(unit)
                    }
                }
            },
            style = MaterialTheme.typography.headlineMedium.copy(
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                lineHeight = 31.sp
            )
        )
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 6.dp)) {
            Text(
                link,
                style = MaterialTheme.typography.labelMedium,
                color = LombadaColors.Sticker,
                modifier = Modifier.weight(1f, fill = false)
            )
            Icon(
                Icons.AutoMirrored.Filled.OpenInNew,
                contentDescription = null,
                tint = LombadaColors.Sticker,
                modifier = Modifier.padding(start = 4.dp).size(16.dp)
            )
        }
    }
}

/** Os três critérios do Teste de Bechdel, na ordem em que o site os aplica. */
private val BECHDEL_CRITERIA =
    listOf("Tem pelo menos duas mulheres com nome", "Elas conversam entre si", "Sobre algo que não seja um homem")

/**
 * Seção "Teste de Bechdel": etiqueta "Passa" ou "Não passa" com quantos critérios o filme
 * cumpre, os três critérios, a nota sobre a fonte (com os avisos de avaliação duvidosa e de
 * contestações) e o link para a página do filme no bechdeltest.com.
 *
 * @param bechdel Avaliação; a seção só deve ser chamada para filmes avaliados no site.
 * @param onOpen Abre a página do filme no site.
 */
@Composable
fun BechdelSection(bechdel: Bechdel, onOpen: (String) -> Unit) {
    val rating = bechdel.rating ?: return
    val siteId = bechdel.siteId ?: return
    val passes = bechdel.passes
    Column(modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 24.dp)) {
        SectionTitle("Teste de Bechdel", Modifier.padding(bottom = 8.dp))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.padding(bottom = 12.dp).semantics(mergeDescendants = true) {}
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier =
                    Modifier
                        .heightIn(min = 26.dp)
                        .background(
                            if (passes) LombadaColors.Sticker else LombadaColors.ShelfHigh,
                            MaterialTheme.shapes.small
                        ).padding(horizontal = 10.dp)
            ) {
                Text(
                    if (passes) "Passa" else "Não passa",
                    style = MaterialTheme.typography.labelLarge.copy(fontSize = 13.5.sp, fontWeight = FontWeight.Bold),
                    color = if (passes) LombadaColors.StickerInk else LombadaColors.Paper
                )
            }
            Text(
                "$rating de ${Bechdel.CRITERIA} critérios",
                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
                color = LombadaColors.Paper2
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            BECHDEL_CRITERIA.forEachIndexed { index, criterion ->
                BechdelCriterion(criterion, met = index < rating)
            }
        }
        val notes =
            listOfNotNull(
                "Avaliação da comunidade do bechdeltest.com.",
                "O site marca esta avaliação como duvidosa.".takeIf { bechdel.dubious },
                when {
                    bechdel.disputes == 1 -> "Uma pessoa contestou a avaliação nos comentários do site."

                    bechdel.disputes > 1 ->
                        "${bechdel.disputes} pessoas contestaram a avaliação nos comentários do site."

                    else -> null
                }
            )
        Text(
            notes.joinToString(" "),
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.5.sp, lineHeight = 20.sp),
            color = LombadaColors.Paper3,
            modifier = Modifier.padding(top = 12.dp)
        )
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier =
                Modifier
                    .heightIn(min = 48.dp)
                    .clickable(role = Role.Button) { onOpen(MovieLinks.bechdel(bechdel.url, siteId)) }
        ) {
            Text(
                "Ver no Bechdel Test",
                style = MaterialTheme.typography.labelMedium.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold),
                color = LombadaColors.Sticker
            )
            Icon(
                Icons.AutoMirrored.Filled.OpenInNew,
                contentDescription = null,
                tint = LombadaColors.Sticker,
                modifier = Modifier.padding(start = 4.dp).size(16.dp)
            )
        }
    }
}

@Composable
private fun BechdelCriterion(criterion: String, met: Boolean) {
    val rule = LombadaColors.Rule
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier.clearAndSetSemantics { contentDescription = "$criterion: ${if (met) "sim" else "não"}" }
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier =
                Modifier
                    .size(24.dp)
                    .then(
                        if (met) {
                            Modifier.background(LombadaColors.ShelfHigh, CircleShape)
                        } else {
                            // Círculo tracejado, como o `border: 1px dashed` do mock.
                            Modifier.drawBehind {
                                val stroke = 1.dp.toPx()
                                drawCircle(
                                    color = rule,
                                    radius = (size.minDimension - stroke) / 2,
                                    style =
                                        Stroke(
                                            width = stroke,
                                            pathEffect = PathEffect.dashPathEffect(
                                                floatArrayOf(3.dp.toPx(), 3.dp.toPx())
                                            )
                                        )
                                )
                            }
                        }
                    )
        ) {
            if (met) {
                Icon(
                    Icons.Filled.Check,
                    contentDescription = null,
                    tint = LombadaColors.Sticker,
                    modifier = Modifier.size(16.dp)
                )
            }
        }
        Text(
            criterion,
            style = MaterialTheme.typography.bodyLarge.copy(fontSize = 15.sp),
            color = if (met) LombadaColors.Paper else LombadaColors.Paper3
        )
    }
}

/**
 * Faixa do elenco: foto redonda de 72dp (iniciais sem foto), nome e personagem; cada ator abre a
 * tela dele. Enquanto o backend busca o elenco, mostra lugares vazios em vez de sumir.
 *
 * @param cast Elenco.
 * @param loading Se o elenco ainda está chegando.
 * @param onOpen Abre a tela do ator.
 */
@Composable
fun CastRow(cast: List<CastMember>, loading: Boolean, onOpen: (CastMember) -> Unit) {
    Column(modifier = Modifier.padding(top = 24.dp)) {
        SectionTitle("Elenco", Modifier.padding(start = 20.dp, end = 20.dp, bottom = 10.dp))
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 20.dp)
        ) {
            if (cast.isEmpty() && loading) {
                items(5) { PersonCircle(null, null, Modifier.semantics { contentDescription = "Carregando elenco" }) }
            } else {
                items(cast, key = { it.id }) { member ->
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                        modifier =
                            Modifier
                                .width(84.dp)
                                .clickable(role = Role.Button, onClickLabel = "Abrir ${member.name}") { onOpen(member) }
                                .semantics(mergeDescendants = true) {
                                    contentDescription = member.name + (member.character?.let { ", como $it" } ?: "")
                                }
                    ) {
                        PersonCircle(member.name, member.profilePath)
                        Text(
                            member.name,
                            style = MaterialTheme.typography.labelMedium.copy(lineHeight = 16.sp),
                            textAlign = TextAlign.Center,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                        member.character?.let {
                            Text(
                                it,
                                style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.5.sp, lineHeight = 14.sp),
                                color = LombadaColors.Paper3,
                                textAlign = TextAlign.Center,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Foto redonda de pessoa, com as iniciais por baixo enquanto a imagem não chega ou sem foto.
 *
 * @param name Nome, para as iniciais; null num lugar vazio de carregamento.
 * @param profilePath Foto no TMDb.
 * @param modifier Modificador do Compose.
 * @param size Diâmetro.
 */
@Composable
fun PersonCircle(
    name: String?,
    profilePath: String?,
    modifier: Modifier = Modifier,
    size: androidx.compose.ui.unit.Dp = 72.dp
) {
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            modifier
                .size(size)
                .border(2.dp, LombadaColors.Rule, CircleShape)
                .clip(CircleShape)
                .background(LombadaColors.ShelfHigh)
    ) {
        if (name != null) {
            Text(
                initialsOf(name),
                style = MaterialTheme.typography.titleLarge.copy(fontSize = (size.value * 0.28f).sp),
                color = LombadaColors.Paper2
            )
        }
        if (profilePath != null) {
            AsyncImage(
                TmdbImages.profile(profilePath),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.size(size)
            )
        }
    }
}
