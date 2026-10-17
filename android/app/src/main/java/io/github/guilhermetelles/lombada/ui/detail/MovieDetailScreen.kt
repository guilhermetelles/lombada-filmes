package io.github.guilhermetelles.lombada.ui.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.Movie
import io.github.guilhermetelles.lombada.data.model.PersonRef
import io.github.guilhermetelles.lombada.domain.Formatting
import io.github.guilhermetelles.lombada.domain.Standing
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.components.LombadaButton
import io.github.guilhermetelles.lombada.ui.components.LombadaButtonStyle
import io.github.guilhermetelles.lombada.ui.components.MovieCover
import io.github.guilhermetelles.lombada.ui.main.MovieRoute
import io.github.guilhermetelles.lombada.ui.main.PersonRoute
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import io.github.guilhermetelles.lombada.ui.theme.RankSticker
import java.time.ZoneId

/**
 * Detalhe do filme: capa, fatos, diretores, a nota de vocês, as quatro notas, sinopse, Teste de
 * Bechdel, elenco e o comentário, com "Editar registro" ou "Adicionar à lista" no rodapé.
 *
 * @param route Filme aberto, com título, ano e capa para a tela abrir na hora.
 * @param ranking Entradas da lista ativa, na ordem do ranking.
 * @param preparingAdd Se o registro deste filme está sendo preparado.
 * @param onBack Volta.
 * @param onOpenPerson Abre a tela de um diretor ou ator.
 * @param onEdit Abre a folha de edição da entrada.
 * @param onAdd Prepara o registro do filme.
 */
@Composable
fun MovieDetailScreen(
    route: MovieRoute,
    ranking: List<Entry>,
    preparingAdd: Boolean,
    onBack: () -> Unit,
    onOpenPerson: (PersonRoute) -> Unit,
    onEdit: (Entry) -> Unit,
    onAdd: (Int) -> Unit
) {
    val container = appContainer()
    val viewModel = viewModel(key = "movie-${route.tmdbId}") { MovieDetailViewModel(container, route.tmdbId) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val uri = LocalUriHandler.current
    val movie = state.movie
    val entry = ranking.firstOrNull { it.tmdbId == route.tmdbId }
    val standing = entry?.let { Standing.of(ranking, it.id) }
    val title = movie?.title ?: entry?.movie?.title ?: route.title
    val year = movie?.year ?: entry?.movie?.year ?: route.year
    val poster = movie?.posterPath ?: entry?.movie?.posterPath ?: route.posterPath
    val refreshing = state.refresh == RefreshStatus.Refreshing

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(LombadaColors.Ground)
                .statusBarsPadding()
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(bottom = 104.dp)
                    .navigationBarsPadding()
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.height(56.dp).padding(horizontal = 4.dp)
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
                }
            }
            Hero(route.tmdbId, title, year, poster, movie, entry, standing?.position, onOpenPerson)
            RefreshNotice(state.refresh, movie, onRetry = viewModel::retry)
            standing?.let { StandingCard(it) }
            Scores(route.tmdbId, title, year, movie, entry, onOpen = uri::openUri)
            Synopsis(movie, loading = movie == null && refreshing)
            movie?.bechdel?.takeIf { it.isRated }?.let { BechdelSection(it, onOpen = uri::openUri) }
            if (movie == null || movie.cast.isNotEmpty() || refreshing) {
                CastRow(
                    cast = movie?.cast.orEmpty(),
                    loading = refreshing,
                    onOpen = { onOpenPerson(PersonRoute(it.id, it.name, it.profilePath, "acting")) }
                )
            }
            if (entry != null) OurNote(entry)
        }
        Footer(entry, preparingAdd, onEdit, onAdd = {
            onAdd(route.tmdbId)
        }, modifier = Modifier.align(Alignment.BottomCenter))
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Hero(
    tmdbId: Int,
    title: String,
    year: Int?,
    poster: String?,
    movie: Movie?,
    entry: Entry?,
    position: Int?,
    onOpenPerson: (PersonRoute) -> Unit
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(18.dp),
        verticalAlignment = Alignment.Bottom,
        modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 8.dp)
    ) {
        MovieCover(title, poster, tmdbId, Modifier.width(132.dp), initialsSize = 34.sp)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                title,
                style = MaterialTheme.typography.headlineSmall.copy(fontSize = 24.sp, lineHeight = 28.sp),
                modifier = Modifier.semantics {
                    heading()
                }
            )
            val facts =
                buildAnnotatedString {
                    year?.let {
                        withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = LombadaColors.Paper)) {
                            append(it.toString())
                        }
                    }
                    movie?.runtime?.let { append(if (year != null) ", $it min" else "$it min") }
                }
            if (facts.isNotEmpty()) {
                Text(
                    facts,
                    style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 21.sp),
                    color = LombadaColors.Paper2,
                    modifier = Modifier.padding(top = 10.dp)
                )
            }
            val directors = movie?.directors?.map { PersonRef(it.id, it.name) } ?: entry?.movie?.directors.orEmpty()
            val photos = movie?.directors?.associate { it.id to it.profilePath }.orEmpty()
            DirectorLinks(directors) { person ->
                onOpenPerson(PersonRoute(person.id, person.name, photos[person.id], "directing"))
            }
            if (entry != null && position != null) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 12.dp)) {
                    RankSticker(position = position, id = entry.id, size = 26.dp)
                    Text(
                        "#$position na sua lista",
                        style = MaterialTheme.typography.bodyMedium,
                        color = LombadaColors.Sticker,
                        modifier = Modifier.padding(start = 8.dp)
                    )
                }
            }
        }
    }
}

/**
 * "Direção de A e B", com cada nome levando para a tela do diretor.
 *
 * @param directors Diretores.
 * @param onOpen Abre a tela de um diretor.
 */
@Composable
private fun DirectorLinks(directors: List<PersonRef>, onOpen: (PersonRef) -> Unit) {
    val style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 21.sp, color = LombadaColors.Paper2)
    if (directors.isEmpty()) return
    val linkStyle =
        TextLinkStyles(
            SpanStyle(
                color = LombadaColors.Paper,
                fontWeight = FontWeight.SemiBold,
                textDecoration = TextDecoration.Underline
            )
        )
    val text =
        buildAnnotatedString {
            append("Direção de ")
            directors.forEachIndexed { index, person ->
                if (index > 0) append(if (index == directors.lastIndex) " e " else ", ")
                withLink(
                    LinkAnnotation.Clickable(person.id.toString(), linkStyle) {
                        onOpen(person)
                    }
                ) { append(person.name) }
            }
        }
    Text(text, style = style)
}

@Composable
private fun RefreshNotice(status: RefreshStatus, movie: Movie?, onRetry: () -> Unit) {
    if (status != RefreshStatus.Offline && status != RefreshStatus.Failed) return
    val updated = listOfNotNull(movie?.tmdbFetchedAt, movie?.imdb?.fetchedAt, movie?.letterboxd?.fetchedAt).maxOrNull()
    val date = updated?.atZone(ZoneId.systemDefault())?.toLocalDate()?.let(Formatting::fullDate)
    val reason = if (status == RefreshStatus.Offline) "Sem internet" else "Não deu para atualizar agora"
    val text =
        when {
            movie == null -> "$reason. Os dados deste filme aparecem quando houver conexão."
            date != null -> "$reason: mostrando os dados salvos em $date."
            else -> "$reason: mostrando os dados salvos."
        }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(start = 20.dp, end = 8.dp, top = 14.dp)
    ) {
        Text(
            text,
            style = MaterialTheme.typography.bodySmall,
            color = LombadaColors.Paper3,
            modifier = Modifier.weight(1f)
        )
        LombadaButton("Tentar de novo", onClick = onRetry, style = LombadaButtonStyle.Text)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Scores(tmdbId: Int, title: String, year: Int?, movie: Movie?, entry: Entry?, onOpen: (String) -> Unit) {
    val imdb = movie?.imdb?.value ?: entry?.movie?.imdb
    val letterboxd = movie?.letterboxd?.value ?: entry?.movie?.letterboxd
    val rottenTomatoes = movie?.rottenTomatoes
    Column(
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 24.dp)
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            ScoreCard("Nota no IMDb", Formatting.oneDecimal(imdb), "/10", "Ver no IMDb", {
                onOpen(MovieLinks.imdb(movie?.imdbId, title, year))
            }, Modifier.weight(1f))
            ScoreCard(
                "Média no Letterboxd",
                Formatting.oneDecimal(letterboxd),
                "/5",
                "Ver no Letterboxd",
                { onOpen(MovieLinks.letterboxd(movie?.letterboxdUrl, tmdbId)) },
                Modifier.weight(1f)
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            ScoreCard(
                "Tomatômetro (Rotten Tomatoes)",
                rottenTomatoes?.value?.toInt()?.toString() ?: "–",
                "%",
                if (rottenTomatoes?.url != null) "Ver no Rotten Tomatoes" else "Buscar no Rotten Tomatoes",
                { onOpen(MovieLinks.rottenTomatoes(rottenTomatoes?.url, title)) },
                Modifier.weight(1f)
            )
            ScoreCard(
                "Metascore (Metacritic)",
                movie?.metacritic?.value?.toInt()?.toString() ?: "–",
                "/100",
                "Buscar no Metacritic",
                { onOpen(MovieLinks.metacritic(title)) },
                Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun Synopsis(movie: Movie?, loading: Boolean) {
    val text = movie?.synopsisPt ?: movie?.synopsisEn
    if (text == null && !loading) return
    Column(modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 24.dp)) {
        SectionTitle("Sinopse", Modifier.padding(bottom = 8.dp))
        Text(
            text ?: "Carregando…",
            style = MaterialTheme.typography.bodyLarge.copy(fontSize = 15.5.sp, lineHeight = 25.sp),
            color = if (text == null) LombadaColors.Paper3 else LombadaColors.Paper2
        )
    }
}

@Composable
private fun OurNote(entry: Entry) {
    Column(
        modifier =
            Modifier
                .padding(start = 20.dp, end = 20.dp, top = 24.dp)
                .fillMaxWidth()
                .background(LombadaColors.Shelf, MaterialTheme.shapes.medium)
                .padding(16.dp)
    ) {
        SectionTitle("O que vocês acharam", Modifier.padding(bottom = 6.dp))
        Text(
            Formatting.seenLine(entry.watchedOn),
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.5.sp),
            color = LombadaColors.Paper2,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        if (entry.comment.isBlank()) {
            Text(
                "Sem comentário ainda.",
                style = MaterialTheme.typography.bodyLarge.copy(fontSize = 15.sp, fontStyle = FontStyle.Italic),
                color = LombadaColors.Paper3
            )
        } else {
            Text(entry.comment, style = MaterialTheme.typography.bodyLarge.copy(fontSize = 15.sp, lineHeight = 23.sp))
        }
    }
}

@Composable
private fun Footer(
    entry: Entry?,
    preparingAdd: Boolean,
    onEdit: (Entry) -> Unit,
    onAdd: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        0f to LombadaColors.Ground.copy(alpha = 0f),
                        0.3f to LombadaColors.Ground
                    )
                )
                .navigationBarsPadding()
                .padding(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 16.dp)
                .heightIn(min = 48.dp)
    ) {
        if (entry != null) {
            LombadaButton("Editar registro", onClick = {
                onEdit(entry)
            }, style = LombadaButtonStyle.Tonal, modifier = Modifier.fillMaxWidth())
        } else {
            LombadaButton("Adicionar à lista", onClick = onAdd, busy = preparingAdd, modifier = Modifier.fillMaxWidth())
        }
    }
}
