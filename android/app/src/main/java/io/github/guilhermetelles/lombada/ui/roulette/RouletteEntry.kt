package io.github.guilhermetelles.lombada.ui.roulette

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.guilhermetelles.lombada.domain.QueueLines
import io.github.guilhermetelles.lombada.domain.Roulette
import io.github.guilhermetelles.lombada.domain.RouletteFilm
import io.github.guilhermetelles.lombada.domain.RouletteFilter
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.components.LombadaButton
import io.github.guilhermetelles.lombada.ui.components.LombadaButtonStyle
import io.github.guilhermetelles.lombada.ui.components.MovieCover
import io.github.guilhermetelles.lombada.ui.main.MovieRoute
import io.github.guilhermetelles.lombada.ui.main.ScreenContext
import io.github.guilhermetelles.lombada.ui.queue.MemberDot
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import io.github.guilhermetelles.lombada.ui.theme.rememberReducedMotion
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

// Fitas que passam antes de parar no sorteado.
private const val REEL_STEPS = 13

/**
 * "O que vamos ver hoje?": filtros rápidos, de onde vêm os candidatos, uma animação curta de fitas
 * passando (instantânea com "remover animações") e o sorteado, com por que combina e onde assistir.
 *
 * @param context Lista, pessoa logada e navegação.
 */
@Composable
fun RouletteEntry(context: ScreenContext) {
    val container = appContainer()
    val listId = context.list.id
    val viewModel =
        viewModel(key = "roulette-$listId") {
            val inList = context.listViewModel.state.map { it.entryByTmdbId.keys }.distinctUntilChanged()
            RouletteViewModel(container, listId, inList)
        }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val reducedMotion = rememberReducedMotion()
    val scope = rememberCoroutineScope()
    var shown by remember { mutableStateOf<RouletteFilm?>(null) }
    var rolling by remember { mutableStateOf(false) }

    LaunchedEffect(state.rollId, state.loading) {
        val pick = state.pick
        val films = state.pool.films
        if (pick == null || reducedMotion || films.size <= 1) {
            shown = pick
            rolling = false
            return@LaunchedEffect
        }
        rolling = true
        val reel = films.shuffled()
        for (step in 0 until REEL_STEPS) {
            shown = reel[step % reel.size]
            delay((45 + (step + 1) * (step + 1) * 1.6).toLong())
        }
        shown = pick
        rolling = false
    }

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
            IconButton(onClick = context.back) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
            }
            Text(
                "O que vamos ver hoje?",
                style = MaterialTheme.typography.titleLarge.copy(fontSize = 18.sp),
                modifier = Modifier.padding(start = 4.dp).semantics { heading() }
            )
        }
        FilterRow(state.filters, onToggle = viewModel::toggle)
        if (state.loading) {
            Box(Modifier.fillMaxWidth().padding(48.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = LombadaColors.Sticker)
            }
            return@Column
        }
        Text(
            Roulette.sourceText(state.pool, state.queueSize),
            style = MaterialTheme.typography.bodyMedium,
            color = LombadaColors.Paper2,
            modifier =
                Modifier
                    .padding(start = 20.dp, end = 20.dp, top = 12.dp)
                    .semantics { liveRegion = LiveRegionMode.Polite }
        )
        val current = shown
        if (current == null) {
            if (!rolling) NothingToRoll()
        } else {
            Stage(current, final = !rolling)
            if (rolling) {
                Text(
                    "Sorteando…",
                    style = MaterialTheme.typography.bodyMedium,
                    color = LombadaColors.Paper3,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(top = 12.dp)
                )
            } else {
                Result(
                    film = current,
                    context = context,
                    onGo = {
                        scope.launch { container.snackbar.showSnackbar("Combinado: hoje é ${current.title}") }
                    },
                    onAgain = viewModel::spin,
                    onOpen = {
                        context.navigate(MovieRoute(current.tmdbId, current.title, current.year, current.posterPath))
                    }
                )
            }
        }
        Text(
            "\"Ruim de propósito\" é nota do TMDb abaixo de 6 (com pelo menos 30 votos). \"Até 1h40\" e " +
                "\"Só streaming\" usam a duração e os serviços no Brasil do TMDb.",
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.5.sp, lineHeight = 19.sp),
            color = LombadaColors.Paper3,
            modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 24.dp, bottom = 24.dp)
        )
    }
}

@Composable
private fun FilterRow(active: Set<RouletteFilter>, onToggle: (RouletteFilter) -> Unit) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier =
            Modifier
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
    ) {
        RouletteFilter.entries.forEach { filter ->
            val selected = filter in active
            FilterChip(
                selected = selected,
                onClick = { onToggle(filter) },
                label = { Text(filter.label) },
                leadingIcon =
                    if (selected) {
                        { Icon(Icons.Filled.Check, contentDescription = null) }
                    } else {
                        null
                    },
                colors =
                    FilterChipDefaults.filterChipColors(
                        containerColor = LombadaColors.Ground,
                        labelColor = LombadaColors.Paper2,
                        selectedContainerColor = LombadaColors.Tonal,
                        selectedLabelColor = LombadaColors.Paper,
                        selectedLeadingIconColor = LombadaColors.Sticker
                    ),
                modifier = Modifier.heightIn(min = 48.dp)
            )
        }
    }
}

@Composable
private fun Stage(film: RouletteFilm, final: Boolean) {
    // A tela anuncia só o resultado; as fitas passando são decorativas.
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = 20.dp)
                .clearAndSetSemantics {}
    ) {
        MovieCover(
            film.title,
            film.posterPath,
            film.tmdbId,
            Modifier.width(if (final) 150.dp else 132.dp),
            initialsSize = 30.sp
        )
        // No resultado, o título já vem logo abaixo, com o ano: aqui só enquanto sorteia.
        if (!final) {
            Text(
                film.title,
                style = MaterialTheme.typography.titleMedium,
                color = LombadaColors.Paper3,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 10.dp)
            )
        }
    }
}

@Composable
private fun Result(
    film: RouletteFilm,
    context: ScreenContext,
    onGo: () -> Unit,
    onAgain: () -> Unit,
    onOpen: () -> Unit
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(10.dp),
        modifier =
            Modifier
                .padding(start = 20.dp, end = 20.dp, top = 16.dp)
                .semantics { liveRegion = LiveRegionMode.Polite }
    ) {
        Text(
            buildAnnotatedString {
                append(film.title)
                film.year?.let {
                    withStyle(SpanStyle(color = LombadaColors.Paper3, fontWeight = FontWeight.Normal)) {
                        append("  $it")
                    }
                }
            },
            style = MaterialTheme.typography.headlineSmall.copy(fontSize = 22.sp)
        )
        val meta =
            listOfNotNull(film.runtime?.let { "$it min" }, film.genres.take(3).joinToString(", ").ifEmpty { null })
        if (meta.isNotEmpty()) {
            Text(meta.joinToString(" · "), style = MaterialTheme.typography.bodyMedium, color = LombadaColors.Paper2)
        }
        film.addedBy?.let { uid ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                MemberDot(context.list.memberProfiles[uid], 20.dp)
                val who =
                    if (uid == context.uid) {
                        "Você pediu"
                    } else {
                        "${context.list.memberProfiles[uid]?.name ?: "Alguém da lista"} pediu"
                    }
                Text(who, style = MaterialTheme.typography.bodySmall, color = LombadaColors.Paper2)
            }
        }
        Column(
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(LombadaColors.Shelf, MaterialTheme.shapes.medium)
                    .padding(14.dp)
        ) {
            if (film.score != null) {
                Fact(
                    "Por que combina",
                    "${film.score}%" + (film.reason?.let { " · ${it.trim().trimEnd('.')}" } ?: "")
                )
            }
            Fact("Onde assistir", QueueLines.where(film.providers)?.removePrefix("Onde assistir: ") ?: "")
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            LombadaButton("Vamos ver este", onClick = onGo, modifier = Modifier.weight(1f))
            LombadaButton(
                "Sortear de novo",
                onClick = onAgain,
                style = LombadaButtonStyle.Tonal,
                modifier = Modifier.weight(1f)
            )
        }
        LombadaButton("Ver o filme", onClick = onOpen, style = LombadaButtonStyle.Text)
    }
}

@Composable
private fun Fact(label: String, text: String) {
    Column(modifier = Modifier.semantics(mergeDescendants = true) {}) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = LombadaColors.Paper3)
        Text(text, style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 21.sp), color = LombadaColors.Paper)
    }
}

@Composable
private fun NothingToRoll() {
    Column(
        modifier =
            Modifier
                .padding(start = 20.dp, end = 20.dp, top = 20.dp)
                .fillMaxWidth()
                .background(LombadaColors.Shelf, MaterialTheme.shapes.large)
                .padding(20.dp)
    ) {
        Text("Nada para sortear", style = MaterialTheme.typography.titleMedium)
        Text(
            "Tire um filtro ou ponha mais filmes na fila.",
            style = MaterialTheme.typography.bodyMedium,
            color = LombadaColors.Paper2,
            modifier = Modifier.padding(top = 4.dp)
        )
    }
}
