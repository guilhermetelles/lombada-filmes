package io.github.guilhermetelles.lombada.ui.person

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import io.github.guilhermetelles.lombada.data.model.Credit
import io.github.guilhermetelles.lombada.data.model.Person
import io.github.guilhermetelles.lombada.domain.Formatting
import io.github.guilhermetelles.lombada.domain.PersonFilm
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.components.MovieCover
import io.github.guilhermetelles.lombada.ui.components.TmdbImages
import io.github.guilhermetelles.lombada.ui.components.initialsOf
import io.github.guilhermetelles.lombada.ui.detail.MovieLinks
import io.github.guilhermetelles.lombada.ui.detail.RefreshStatus
import io.github.guilhermetelles.lombada.ui.main.MovieRoute
import io.github.guilhermetelles.lombada.ui.main.PersonRoute
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import java.time.ZoneId

private const val OTHER_DIRECTED = 8
private const val OTHER_ACTED = 20

/**
 * Tela de um diretor ou ator, em duas etapas: o que já se sabe pelos filmes da lista aparece na
 * hora; a ficha do TMDb completa nascimento, biografia e filmografia quando chega.
 *
 * @param route Pessoa aberta.
 * @param listId Lista ativa.
 * @param onBack Volta.
 * @param onOpenMovie Abre o detalhe de um filme.
 */
@Composable
fun PersonScreen(route: PersonRoute, listId: String, onBack: () -> Unit, onOpenMovie: (MovieRoute) -> Unit) {
    val container = appContainer()
    val viewModel =
        viewModel(key = "person-${route.personId}") {
            PersonViewModel(container, listId, route.personId, route.profilePath)
        }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val uri = LocalUriHandler.current
    val person = state.person
    val directing = route.department == "directing"
    val name = person?.name ?: route.name
    val inList = state.films.map { it.entry.tmdbId }.toSet()

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(LombadaColors.Ground)
                .statusBarsPadding()
                .verticalScroll(rememberScrollState())
                .navigationBarsPadding()
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.height(56.dp).padding(horizontal = 4.dp)
        ) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar") }
            Text(
                if (directing) "Diretor" else "Elenco",
                style = MaterialTheme.typography.titleLarge.copy(fontSize = 18.sp),
                modifier = Modifier.padding(start = 4.dp)
            )
        }
        Hero(
            route.personId,
            name,
            state.photo,
            person,
            directing,
            state.refresh,
            onOpen = uri::openUri,
            onRetry = viewModel::retry
        )
        InListSection(state.films, onOpenMovie)
        person?.biography?.let { Biography(it, person.biographyInEnglish) }
        person?.let { full ->
            if (directing) {
                val others = full.directed.filter { it.tmdbId !in inList }.take(OTHER_DIRECTED)
                if (others.isNotEmpty()) Filmography("Outros filmes dirigidos", others, null, onOpenMovie)
            } else {
                val others = full.acted.filter { it.tmdbId !in inList }.take(OTHER_ACTED)
                if (others.isNotEmpty()) {
                    Filmography(
                        "Filmes de que participou",
                        others,
                        "Os ${others.size} mais votados no TMDb, fora os que já aparecem acima.",
                        onOpenMovie
                    )
                }
            }
        }
        val updated = person?.fetchedAt?.atZone(ZoneId.systemDefault())?.toLocalDate()?.let(Formatting::shortDate)
        Text(
            "Dados ${if (directing) "do diretor" else "do ator"}: TMDb${updated?.let {
                ", atualizados em $it"
            } ?: ""}. " +
                "Este app usa a API do TMDb, mas não é endossado nem certificado pelo TMDb.",
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.5.sp, lineHeight = 19.sp),
            color = LombadaColors.Paper3,
            modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 24.dp)
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Hero(
    personId: Int,
    name: String,
    photo: String?,
    person: Person?,
    directing: Boolean,
    refresh: RefreshStatus,
    onOpen: (String) -> Unit,
    onRetry: () -> Unit
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalAlignment = Alignment.Bottom,
        modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 4.dp)
    ) {
        val shape = RoundedCornerShape(8.dp)
        Box(
            contentAlignment = Alignment.Center,
            modifier =
                Modifier
                    .size(96.dp, 144.dp)
                    .shadow(8.dp, shape)
                    .clip(shape)
                    .background(LombadaColors.ShelfHigh)
        ) {
            Text(
                initialsOf(name),
                style = MaterialTheme.typography.headlineLarge.copy(fontSize = 30.sp),
                color = LombadaColors.Paper2
            )
            if (photo != null) {
                AsyncImage(
                    TmdbImages.profile(photo),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.size(96.dp, 144.dp)
                )
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                name,
                style = MaterialTheme.typography.headlineMedium.copy(fontSize = 26.sp, lineHeight = 29.sp),
                modifier = Modifier.semantics {
                    heading()
                }
            )
            val facts = person?.let { factsOf(it, directing) }
            val style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.5.sp, lineHeight = 20.sp)
            when {
                facts != null -> Text(
                    facts,
                    style = style,
                    color = LombadaColors.Paper2,
                    modifier = Modifier.padding(top = 8.dp)
                )

                refresh == RefreshStatus.Refreshing ->
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(14.dp),
                            strokeWidth = 2.dp,
                            color = LombadaColors.Sticker
                        )
                        Text(
                            "Buscando a ficha no TMDb…",
                            style = style,
                            color = LombadaColors.Paper3,
                            modifier = Modifier.padding(start = 8.dp)
                        )
                    }

                else ->
                    Column(modifier = Modifier.padding(top = 8.dp)) {
                        Text(
                            if (refresh ==
                                RefreshStatus.Offline
                            ) {
                                "Sem internet: a ficha completa aparece quando houver conexão."
                            } else {
                                "Não deu para buscar a ficha agora."
                            },
                            style = style,
                            color = LombadaColors.Paper3
                        )
                        TextButton(onClick = onRetry) { Text("Tentar de novo", color = LombadaColors.Sticker) }
                    }
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(16.dp), modifier = Modifier.padding(top = 8.dp)) {
                ExternalLink("TMDb") { onOpen(MovieLinks.tmdbPerson(personId)) }
                person?.imdbId?.let { ExternalLink("IMDb") { onOpen(MovieLinks.imdbPerson(it)) } }
            }
        }
    }
}

private fun factsOf(person: Person, directing: Boolean): String? {
    val born =
        person.birthday?.let { date ->
            "Nasceu em ${Formatting.fullDate(date)}" + (person.placeOfBirth?.let { ", em $it" } ?: "") + "."
        }
    val died = person.deathday?.let { "Morreu em ${Formatting.fullDate(it)}." }
    val count =
        if (directing) {
            person.directedCount.takeIf {
                it > 0
            }?.let { "Dirigiu ${Formatting.count(it, "filme", "filmes")}, segundo o TMDb." }
        } else {
            person.actedCount.takeIf {
                it > 0
            }?.let { "Atuou em ${Formatting.count(it, "filme", "filmes")}, segundo o TMDb." }
        }
    val first = listOfNotNull(born, died).joinToString(" ").ifEmpty { null }
    return listOfNotNull(first, count).joinToString("\n").ifEmpty { null }
}

@Composable
private fun ExternalLink(label: String, onClick: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier =
            Modifier
                .heightIn(min = 40.dp)
                .clickable(role = Role.Button, onClickLabel = "Abrir no $label", onClick = onClick)
    ) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = LombadaColors.Sticker)
        Icon(
            Icons.AutoMirrored.Filled.OpenInNew,
            contentDescription = null,
            tint = LombadaColors.Sticker,
            modifier = Modifier.padding(start = 4.dp).size(16.dp)
        )
    }
}

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Column(
        modifier =
            Modifier
                .padding(start = 16.dp, end = 16.dp, top = 16.dp)
                .fillMaxWidth()
                .background(LombadaColors.Shelf, MaterialTheme.shapes.large)
                .padding(16.dp)
    ) {
        Text(
            title,
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(bottom = 10.dp).semantics {
                heading()
            }
        )
        content()
    }
}

@Composable
private fun InListSection(films: List<PersonFilm>, onOpenMovie: (MovieRoute) -> Unit) {
    Section("Na lista de vocês") {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(bottom = 12.dp)) {
            Tile(
                films.size.toString(),
                null,
                if (films.size ==
                    1
                ) {
                    "filme na lista"
                } else {
                    "filmes na lista"
                },
                Modifier.weight(1f)
            )
            val average = films.map { it.score }.average().takeIf { films.isNotEmpty() }
            Tile(Formatting.oneDecimal(average), "/10", "nota média de vocês", Modifier.weight(1f))
        }
        if (films.isEmpty()) {
            Text(
                "Nenhum filme com essa pessoa na lista.",
                style = MaterialTheme.typography.bodySmall,
                color = LombadaColors.Paper3
            )
        }
        films.forEach { film ->
            val movie = film.entry.movie
            val role =
                when {
                    film.character != null -> "como ${film.character}. "
                    film.directed -> "Direção. "
                    else -> ""
                }
            val seen = film.entry.watchedOn?.let { ", visto em ${Formatting.shortDate(it)}" } ?: ""
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 72.dp)
                        .clip(MaterialTheme.shapes.medium)
                        .clickable(role = Role.Button, onClickLabel = "Abrir ${movie.title}") {
                            onOpenMovie(MovieRoute(film.entry.tmdbId, movie.title, movie.year, movie.posterPath))
                        }.padding(vertical = 6.dp)
            ) {
                MovieCover(
                    movie.title,
                    movie.posterPath,
                    film.entry.tmdbId,
                    Modifier.width(44.dp),
                    initialsSize = 12.sp
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        buildAnnotatedString {
                            append(movie.title)
                            movie.year?.let {
                                withStyle(
                                    SpanStyle(
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = LombadaColors.Paper3
                                    )
                                ) {
                                    append("  $it")
                                }
                            }
                        },
                        style = MaterialTheme.typography.titleSmall.copy(
                            fontSize = 15.5.sp,
                            fontWeight = FontWeight.Bold
                        )
                    )
                    Text(
                        "$role#${film.position} na lista$seen",
                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.5.sp),
                        color = LombadaColors.Paper2,
                        modifier = Modifier.padding(top = 3.dp)
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        "Vocês",
                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                        color = LombadaColors.Paper3
                    )
                    Text(
                        Formatting.oneDecimal(film.score),
                        style = MaterialTheme.typography.titleMedium,
                        color = LombadaColors.Sticker
                    )
                }
            }
        }
    }
}

@Composable
private fun Tile(value: String, unit: String?, label: String, modifier: Modifier = Modifier) {
    Column(
        modifier =
            modifier
                .background(LombadaColors.Ground, MaterialTheme.shapes.medium)
                .padding(horizontal = 14.dp, vertical = 12.dp)
    ) {
        Text(
            buildAnnotatedString {
                append(value)
                if (unit != null &&
                    value != "–"
                ) {
                    withStyle(
                        SpanStyle(fontSize = 14.sp, fontWeight = FontWeight.Medium, color = LombadaColors.Paper3)
                    ) {
                        append(unit)
                    }
                }
            },
            style = MaterialTheme.typography.headlineSmall.copy(fontSize = 26.sp, lineHeight = 30.sp)
        )
        Text(label, style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp), color = LombadaColors.Paper2)
    }
}

@Composable
private fun Biography(text: String, inEnglish: Boolean) {
    var open by rememberSaveable { mutableStateOf(false) }
    var overflows by remember(text) { mutableStateOf(false) }
    Section("Biografia") {
        Text(
            text,
            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.5.sp, lineHeight = 23.sp),
            color = LombadaColors.Paper2,
            maxLines = if (open) Int.MAX_VALUE else 6,
            onTextLayout = { if (!open) overflows = it.hasVisualOverflow }
        )
        if (overflows || open) {
            TextButton(onClick = { open = !open }, modifier = Modifier.padding(top = 2.dp)) {
                Text(if (open) "Mostrar menos" else "Ler biografia completa", color = LombadaColors.Sticker)
            }
        }
        if (inEnglish) {
            Text(
                "O TMDb não tem biografia em português; esta está em inglês.",
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                color = LombadaColors.Paper3,
                modifier = Modifier.padding(top = 6.dp)
            )
        }
    }
}

@Composable
private fun Filmography(title: String, credits: List<Credit>, note: String?, onOpenMovie: (MovieRoute) -> Unit) {
    Section(title) {
        credits.forEach { credit ->
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clickable(role = Role.Button, onClickLabel = "Abrir ${credit.title}") {
                            onOpenMovie(MovieRoute(credit.tmdbId, credit.title, credit.year))
                        }
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.heightIn(min = 40.dp).padding(vertical = 6.dp)
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(credit.title, style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.5.sp))
                        credit.character?.let {
                            Text(
                                "como $it",
                                style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                                color = LombadaColors.Paper3
                            )
                        }
                    }
                    Text(
                        credit.year?.toString().orEmpty(),
                        style = MaterialTheme.typography.bodyMedium,
                        color = LombadaColors.Paper3,
                        modifier = Modifier.padding(start = 12.dp)
                    )
                }
                HorizontalDivider(color = LombadaColors.Rule)
            }
        }
        note?.let {
            Text(
                it,
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                color = LombadaColors.Paper3,
                modifier = Modifier.padding(top = 6.dp)
            )
        }
    }
}
