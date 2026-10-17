package io.github.guilhermetelles.lombada.ui.search

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
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
import io.github.guilhermetelles.lombada.data.backend.MovieSearchResult
import io.github.guilhermetelles.lombada.data.backend.PersonSearchResult
import io.github.guilhermetelles.lombada.domain.ListMatch
import io.github.guilhermetelles.lombada.ui.components.MovieCover
import io.github.guilhermetelles.lombada.ui.components.TmdbImages
import io.github.guilhermetelles.lombada.ui.components.initialsOf
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import io.github.guilhermetelles.lombada.ui.theme.RankSticker

/**
 * Os três grupos da busca dentro da lista rolável; grupo vazio não aparece.
 *
 * @param state Resultados.
 * @param positions Posição de cada entrada no ranking.
 * @param tmdbIdsInList Filmes que já estão na lista.
 * @param preparingTmdbId Filme sendo preparado para adicionar, com indicador.
 * @param onOpenEntry Abre uma entrada da lista.
 * @param onOpenPerson Abre a tela da pessoa.
 * @param onPickMovie Escolhe um filme do TMDb.
 */
fun LazyListScope.searchResults(
    state: SearchUiState,
    positions: Map<String, Int>,
    tmdbIdsInList: Map<Int, String>,
    preparingTmdbId: Int?,
    onOpenEntry: (String) -> Unit,
    onOpenPerson: (PersonSearchResult) -> Unit,
    onPickMovie: (MovieSearchResult) -> Unit
) {
    val term = state.query.trim()
    if (state.inList.isNotEmpty()) {
        item(key = "h-list") { GroupHeader("Na lista de vocês", state.inList.size) }
        items(state.inList, key = { "l-${it.entry.id}" }) { match ->
            ListMatchRow(match, positions[match.entry.id] ?: 0) { onOpenEntry(match.entry.id) }
        }
    }
    if (state.people.items.isNotEmpty()) {
        item(key = "h-people") { GroupHeader("Pessoas", null) }
        items(state.people.items, key = { "p-${it.personId}" }) { person -> PersonRow(person) { onOpenPerson(person) } }
    }
    if (state.movies.items.isNotEmpty()) {
        item(key = "h-movies") { GroupHeader("Filmes", state.movies.items.size) }
        items(state.movies.items, key = { "m-${it.tmdbId}" }) { movie ->
            val entryId = tmdbIdsInList[movie.tmdbId]
            MovieResultRow(
                movie,
                entryId?.let {
                    positions[it]
                },
                entryId,
                preparingTmdbId == movie.tmdbId
            ) { onPickMovie(movie) }
        }
    }
    val loading = state.people.loading || state.movies.loading
    val error = state.movies.error ?: state.people.error
    when {
        loading -> item(key = "s-loading") { Searching() }

        error != null && state.movies.items.isEmpty() -> item(key = "s-error") { Notice(error, null) }

        term.length < 2 && state.inList.isEmpty() -> item(key = "s-short") {
            Notice("Digite pelo menos 2 letras.", null)
        }

        state.inList.isEmpty() && state.people.items.isEmpty() && state.movies.items.isEmpty() && term.length >= 2 ->
            item(key = "s-empty") {
                Notice(
                    "Nada com “$term”",
                    "Tente o título original em inglês, o ano ou o nome de quem dirigiu ou atuou."
                )
            }
    }
    item(key = "s-end") { HorizontalDivider(color = LombadaColors.Rule, modifier = Modifier.padding(bottom = 40.dp)) }
}

@Composable
private fun GroupHeader(title: String, count: Int?) {
    Row(
        verticalAlignment = Alignment.Bottom,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = 20.dp, end = 20.dp, top = 14.dp, bottom = 8.dp)
                .semantics { heading() }
    ) {
        Text(title, style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
        if (count !=
            null
        ) {
            Text(count.toString(), style = MaterialTheme.typography.bodySmall, color = LombadaColors.Paper3)
        }
    }
}

@Composable
private fun ResultRow(
    onClick: () -> Unit,
    label: String,
    leading: @Composable () -> Unit,
    content: @Composable () -> Unit
) {
    Column {
        HorizontalDivider(color = LombadaColors.Rule)
        Row(
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(role = Role.Button, onClickLabel = label, onClick = onClick)
                    .padding(horizontal = 20.dp, vertical = 12.dp)
        ) {
            Box(Modifier.width(52.dp)) { leading() }
            Column(modifier = Modifier.weight(1f)) { content() }
        }
    }
}

@Composable
private fun TitleWithYear(title: String, year: Int?) {
    Text(
        buildAnnotatedString {
            append(title)
            year?.let {
                withStyle(SpanStyle(fontSize = 14.sp, fontWeight = FontWeight.Medium, color = LombadaColors.Paper3)) {
                    append("  $it")
                }
            }
        },
        style = MaterialTheme.typography.titleMedium.copy(fontSize = 17.sp, lineHeight = 21.sp)
    )
}

@Composable
private fun ListMatchRow(match: ListMatch, position: Int, onClick: () -> Unit) {
    val movie = match.entry.movie
    ResultRow(onClick, "Abrir ${movie.title}", leading = {
        MovieCover(movie.title, movie.posterPath, match.entry.tmdbId, Modifier.fillMaxWidth(), initialsSize = 15.sp)
    }) {
        TitleWithYear(movie.title, movie.year)
        if (match.reason != null) {
            Text(
                match.reason,
                style = MaterialTheme.typography.bodyMedium,
                color = LombadaColors.Paper2,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
        OnShelf(position, match.entry.id)
    }
}

@Composable
private fun MovieResultRow(
    movie: MovieSearchResult,
    position: Int?,
    entryId: String?,
    preparing: Boolean,
    onClick: () -> Unit
) {
    ResultRow(onClick, "Abrir ${movie.title}", leading = {
        MovieCover(movie.title, movie.posterPath, movie.tmdbId, Modifier.fillMaxWidth(), initialsSize = 15.sp)
    }) {
        TitleWithYear(movie.title, movie.year)
        val original = movie.originalTitle?.takeIf { it != movie.title }
        val blurb = listOfNotNull(original, movie.overview).joinToString(" · ")
        if (blurb.isNotEmpty()) {
            Text(
                blurb,
                style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 20.sp),
                color = LombadaColors.Paper2,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
        if (position != null && entryId != null) OnShelf(position, entryId)
        if (preparing) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
                CircularProgressIndicator(
                    modifier = Modifier.size(16.dp),
                    strokeWidth = 2.dp,
                    color = LombadaColors.Sticker
                )
                Text(
                    "Buscando dados do filme…",
                    style = MaterialTheme.typography.bodySmall,
                    color = LombadaColors.Sticker,
                    modifier = Modifier.padding(start = 8.dp)
                )
            }
        }
    }
}

@Composable
private fun OnShelf(position: Int, entryId: String) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
        RankSticker(position = position, id = entryId, size = 24.dp)
        Text(
            "Já está na prateleira",
            style = MaterialTheme.typography.bodySmall,
            color = LombadaColors.Sticker,
            modifier = Modifier.padding(start = 6.dp)
        )
    }
}

@Composable
private fun PersonRow(person: PersonSearchResult, onClick: () -> Unit) {
    val role = if (person.department == "directing") "Direção" else "Atuação"
    ResultRow(
        onClick,
        "Abrir ${person.name}",
        leading = {
            Box(
                contentAlignment = Alignment.Center,
                modifier =
                    Modifier
                        .size(52.dp)
                        .clip(CircleShape)
                        .background(LombadaColors.Tonal)
            ) {
                Text(initialsOf(person.name), style = MaterialTheme.typography.titleSmall, color = LombadaColors.Paper)
                if (person.profilePath != null) {
                    AsyncImage(
                        TmdbImages.profile(person.profilePath),
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.size(52.dp)
                    )
                }
            }
        }
    ) {
        Text(person.name, style = MaterialTheme.typography.titleMedium.copy(fontSize = 17.sp))
        val known = person.knownFor.joinToString(", ")
        Text(
            if (known.isEmpty()) role else "$role · $known",
            style = MaterialTheme.typography.bodyMedium,
            color = LombadaColors.Paper2,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 4.dp)
        )
    }
}

@Composable
private fun Searching() {
    Box(
        Modifier
            .fillMaxWidth()
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) { CircularProgressIndicator(color = LombadaColors.Sticker) }
}

@Composable
private fun Notice(title: String, body: String?) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 28.dp, vertical = 36.dp)
    ) {
        Text(title, style = MaterialTheme.typography.titleLarge, textAlign = TextAlign.Center)
        if (body != null) {
            Text(
                body,
                style = MaterialTheme.typography.bodyLarge.copy(fontSize = 15.sp),
                color = LombadaColors.Paper2,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
    }
}
