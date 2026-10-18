package io.github.guilhermetelles.lombada.ui.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.guilhermetelles.lombada.data.model.AwardItem
import io.github.guilhermetelles.lombada.domain.AwardGroup
import io.github.guilhermetelles.lombada.domain.AwardGroups
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/**
 * Conteúdo de "Prêmios e indicações": o resumo, a frase da Framboesa, os grupos por premiação e a
 * fonte. Serve à página do filme e às telas do diretor e do ator; quem chama põe o título e a moldura.
 *
 * @param groups Grupos por premiação, já na ordem da tela.
 * @param summary Frase de resumo (OMDb no filme; contagem na pessoa), se houver.
 * @param razzieNote Destaque da Framboesa, se houver.
 * @param cardColor Fundo de cada premiação; mais claro quando a seção já está sobre uma superfície.
 */
@Composable
fun AwardsContent(
    groups: List<AwardGroup>,
    summary: String?,
    razzieNote: String?,
    cardColor: Color = LombadaColors.Shelf
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        summary?.let {
            Text(
                it,
                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.5.sp, lineHeight = 22.sp),
                color = LombadaColors.Paper2
            )
        }
        razzieNote?.let {
            Text(
                it,
                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold),
                color = LombadaColors.PosterOrange
            )
        }
        groups.forEach { AwardOrg(it, cardColor) }
        Text(
            AwardGroups.SOURCE,
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.5.sp, lineHeight = 19.sp),
            color = LombadaColors.Paper3
        )
    }
}

/**
 * Seção "Prêmios e indicações" da página do filme, com a Framboesa de Ouro em destaque. Sem
 * prêmios nem resumo, a seção não aparece.
 *
 * @param items Prêmios e indicações do filme.
 * @param summary Resumo da OMDb, se houver.
 */
@Composable
fun MovieAwardsSection(items: List<AwardItem>, summary: String?) {
    val groups = AwardGroups.forMovie(items)
    val sentence = summary?.trim()?.trimEnd('.')?.takeIf { it.isNotEmpty() }?.let { "$it." }
    if (groups.isEmpty() && sentence == null) return
    Column(modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 24.dp)) {
        SectionTitle("Prêmios e indicações", Modifier.padding(bottom = 10.dp))
        AwardsContent(groups, sentence, AwardGroups.razzieNote(groups))
    }
}

@Composable
private fun AwardOrg(group: AwardGroup, cardColor: Color) {
    val razzie = group.isRazzie
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(
                    if (razzie) LombadaColors.PosterOrange.copy(alpha = 0.12f) else cardColor,
                    MaterialTheme.shapes.medium
                ).padding(horizontal = 14.dp, vertical = 12.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 6.dp)) {
            if (razzie) {
                Box(
                    modifier =
                        Modifier
                            .padding(end = 8.dp)
                            .background(LombadaColors.PosterOrange, MaterialTheme.shapes.small)
                            .padding(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Text(
                        "Pior do ano",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = LombadaColors.OnOrange
                    )
                }
            }
            Text(
                group.org,
                style = MaterialTheme.typography.titleSmall.copy(fontSize = 15.sp),
                modifier = Modifier.weight(1f)
            )
            Text(group.tally, style = MaterialTheme.typography.bodySmall, color = LombadaColors.Paper3)
        }
        group.items.forEach { AwardLine(it, razzie) }
    }
}

@Composable
private fun AwardLine(item: AwardItem, razzie: Boolean) {
    val kind =
        when {
            !item.isWin -> "Indicado"
            razzie -> "Levou"
            else -> "Venceu"
        }
    Row(
        verticalAlignment = Alignment.Top,
        modifier = Modifier.padding(vertical = 3.dp).semantics(mergeDescendants = true) {}
    ) {
        Text(
            kind,
            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
            color = if (item.isWin) LombadaColors.Sticker else LombadaColors.Paper3,
            modifier = Modifier.width(72.dp)
        )
        val text =
            buildAnnotatedString {
                val category = item.category?.trim()?.takeIf { it.isNotEmpty() }
                if (category != null) {
                    append(category.replaceFirstChar { it.uppercaseChar() })
                } else {
                    withStyle(SpanStyle(fontStyle = FontStyle.Italic, color = LombadaColors.Paper3)) {
                        append("A fonte não diz a categoria")
                    }
                }
                item.work?.trim()?.takeIf { it.isNotEmpty() }?.let {
                    withStyle(SpanStyle(color = LombadaColors.Paper3)) { append(", por $it") }
                }
                item.year?.let {
                    withStyle(SpanStyle(color = LombadaColors.Paper3)) { append("  $it") }
                }
            }
        Text(text, style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 20.sp), modifier = Modifier.weight(1f))
    }
}
