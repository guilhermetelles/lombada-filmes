package io.github.guilhermetelles.lombada.ui.reports

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.guilhermetelles.lombada.domain.AwardGroups
import io.github.guilhermetelles.lombada.domain.AwardsReport
import io.github.guilhermetelles.lombada.domain.AwardsRow
import io.github.guilhermetelles.lombada.domain.Formatting
import io.github.guilhermetelles.lombada.ui.components.MovieCover
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

private const val AWARDS_SUBTITLE =
    "Os filmes mais premiados da lista e os que concorreram ao prêmio de pior do ano. Toque num filme para abrir."

/**
 * Card "Oscar contra Framboesa": a frase com as contagens, os mais premiados, os campeões da
 * Framboesa, os filmes com os dois e a posição média de cada grupo.
 *
 * @param report Card calculado em `Reports.awards`.
 * @param onOpen Abre o filme de uma linha.
 */
@Composable
fun AwardsCard(report: AwardsReport, onOpen: (AwardsRow) -> Unit) {
    ReportSection("Oscar contra Framboesa", AnnotatedString(AWARDS_SUBTITLE)) {
        Text(
            report.headline,
            style = MaterialTheme.typography.titleSmall.copy(
                fontSize = 16.sp,
                lineHeight = 22.sp,
                fontWeight = FontWeight.SemiBold
            ),
            color = LombadaColors.Paper,
            modifier = Modifier.padding(bottom = 6.dp)
        )
        if (report.mostAwarded.isNotEmpty()) {
            Heading("Mais premiados", razzie = false)
            report.mostAwarded.forEach { FilmRow(it, LombadaColors.Paper2, onOpen) }
        }
        if (report.razzies.isNotEmpty()) {
            Heading("Campeões da Framboesa", razzie = true)
            report.razzies.forEach { FilmRow(it, LombadaColors.PosterOrange, onOpen) }
        }
        if (report.both.isNotEmpty()) {
            Heading("Oscar e Framboesa no mesmo filme", razzie = false)
            report.both.forEach { FilmRow(it, LombadaColors.Paper2, onOpen) }
        }
        val oscar = report.oscarAverageRank
        val razzie = report.razzieAverageRank
        if (oscar != null && razzie != null) {
            Text(
                buildAnnotatedString {
                    append("Quem ganhou Oscar fica em média em ")
                    withStyle(SpanStyle(color = LombadaColors.Paper, fontWeight = FontWeight.SemiBold)) {
                        append("#$oscar")
                    }
                    append(" no ranking de vocês; quem concorreu à Framboesa, em ")
                    withStyle(SpanStyle(color = LombadaColors.Paper, fontWeight = FontWeight.SemiBold)) {
                        append("#$razzie")
                    }
                },
                style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 20.sp),
                color = LombadaColors.Paper2,
                modifier = Modifier.padding(top = 14.dp)
            )
        }
        Text(
            AwardGroups.SOURCE,
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp, lineHeight = 17.sp),
            color = LombadaColors.Paper3,
            modifier = Modifier.padding(top = 12.dp)
        )
    }
}

@Composable
private fun Heading(text: String, razzie: Boolean) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(top = 16.dp, bottom = 6.dp).semantics(mergeDescendants = true) { heading() }
    ) {
        if (razzie) {
            Box(
                modifier =
                    Modifier
                        .padding(end = 8.dp)
                        .background(LombadaColors.PosterOrange, MaterialTheme.shapes.small)
                        .padding(horizontal = 7.dp, vertical = 2.dp)
            ) {
                Text(
                    "Pior do ano",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontSize = 10.5.sp,
                        fontWeight = FontWeight.ExtraBold
                    ),
                    color = LombadaColors.OnOrange
                )
            }
        }
        Text(
            text,
            style = MaterialTheme.typography.labelLarge.copy(fontSize = 13.sp, fontWeight = FontWeight.Bold),
            color = LombadaColors.Paper2
        )
    }
}

@Composable
private fun FilmRow(row: AwardsRow, detailColor: Color, onOpen: (AwardsRow) -> Unit) {
    val movie = row.entry.movie
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .clickable(role = Role.Button) { onOpen(row) }
                .semantics(mergeDescendants = true) {
                    contentDescription =
                        "${movie.title}${movie.year?.let {
                            " ($it)"
                        }.orEmpty()}, ${row.detail}, posição ${row.position}"
                }
                .padding(vertical = 4.dp)
    ) {
        MovieCover(
            title = movie.title,
            posterPath = movie.posterPath,
            seed = row.entry.tmdbId,
            modifier = Modifier.width(34.dp),
            initialsSize = 10.sp
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                buildAnnotatedString {
                    append(Formatting.shortTitle(movie.title))
                    movie.year?.let { year ->
                        withStyle(
                            SpanStyle(fontSize = 12.5.sp, fontWeight = FontWeight.Normal, color = LombadaColors.Paper3)
                        ) {
                            append("  $year")
                        }
                    }
                },
                style = MaterialTheme.typography.bodyLarge.copy(
                    fontSize = 14.5.sp,
                    lineHeight = 18.sp,
                    fontWeight = FontWeight.SemiBold
                )
            )
            Text(
                row.detail,
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.5.sp),
                color = detailColor,
                modifier = Modifier.padding(top = 2.dp)
            )
        }
        Text(
            "#${row.position}",
            style = MaterialTheme.typography.titleMedium.copy(fontSize = 15.sp, fontWeight = FontWeight.ExtraBold),
            color = LombadaColors.Sticker
        )
    }
}
