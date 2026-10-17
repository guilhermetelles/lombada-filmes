package io.github.guilhermetelles.lombada.ui.main

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavBackStackEntry
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import io.github.guilhermetelles.lombada.data.model.MovieList
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.detail.MovieDetailScreen
import io.github.guilhermetelles.lombada.ui.list.EntrySheet
import io.github.guilhermetelles.lombada.ui.list.ListScreen
import io.github.guilhermetelles.lombada.ui.list.ListViewModel
import io.github.guilhermetelles.lombada.ui.person.PersonScreen
import io.github.guilhermetelles.lombada.ui.search.SearchViewModel
import io.github.guilhermetelles.lombada.ui.theme.LombadaMotion

private const val TRANSITION_MS = 300

/**
 * App com uma lista aberta: a navegação entre lista, detalhe e pessoa, e as folhas de registrar e
 * editar, que abrem por cima de qualquer tela.
 *
 * @param list Lista ativa.
 * @param uid Pessoa logada.
 * @param onSwitchList Abre "Suas listas".
 * @param onSignOut Sair da conta.
 */
@Composable
fun MainScreen(list: MovieList, uid: String, onSwitchList: () -> Unit, onSignOut: () -> Unit) {
    val container = appContainer()
    val listViewModel = viewModel(key = "list-${list.id}") { ListViewModel(container, list.id, uid) }
    val searchViewModel = viewModel(key = "search-${list.id}") { SearchViewModel(container, list.id) }
    val state by listViewModel.state.collectAsStateWithLifecycle()
    val navController = rememberNavController()

    NavHost(
        navController = navController,
        startDestination = ListRoute,
        enterTransition = { sharedAxisIn(forward = true) },
        exitTransition = { sharedAxisOut(forward = true) },
        popEnterTransition = { sharedAxisIn(forward = false) },
        popExitTransition = { sharedAxisOut(forward = false) }
    ) {
        composable<ListRoute> {
            ListScreen(
                list = list,
                viewModel = listViewModel,
                searchViewModel = searchViewModel,
                onSwitchList = onSwitchList,
                onOpenMovie = { navController.navigate(it) },
                onOpenPerson = { navController.navigate(it) },
                onSignOut = onSignOut
            )
        }
        composable<MovieRoute> { entry: NavBackStackEntry ->
            val route = entry.toRoute<MovieRoute>()
            MovieDetailScreen(
                route = route,
                ranking = state.ranking,
                preparingAdd = state.preparingTmdbId == route.tmdbId,
                onBack = { navController.popBackStack() },
                onOpenPerson = { navController.navigate(it) },
                onEdit = { listViewModel.openEditor(it.id) },
                onAdd = listViewModel::startAdd
            )
        }
        composable<PersonRoute> { entry: NavBackStackEntry ->
            PersonScreen(route = entry.toRoute<PersonRoute>(), onBack = { navController.popBackStack() })
        }
    }

    // Filme registrado a partir do detalhe: volta para a lista, que rola até a entrada nova.
    LaunchedEffect(state.justAddedId) {
        if (state.justAddedId != null) navController.popBackStack(ListRoute, inclusive = false)
    }

    state.adding?.let { draft ->
        EntrySheet(
            movie = draft.movie,
            tmdbId = draft.tmdbId,
            subtitle = "Entra como #${state.ranking.size + 1}; depois é só arrastar",
            initialDate = null,
            initialComment = "",
            adding = true,
            onSave = { date, comment -> listViewModel.confirmAdd(draft, date, comment) },
            onRemove = null,
            onDismiss = listViewModel::cancelAdd
        )
    }

    state.editing?.let { entry ->
        EntrySheet(
            movie = entry.movie,
            tmdbId = entry.tmdbId,
            subtitle = "#${state.positions[entry.id]} na lista",
            initialDate = entry.watchedOn,
            initialComment = entry.comment,
            adding = false,
            onSave = { date, comment -> listViewModel.save(entry, date, comment) },
            onRemove = { listViewModel.remove(entry) },
            onDismiss = listViewModel::closeEditor
        )
    }
}

/** Shared axis horizontal do DESIGN.md: a tela nova entra pela direita e a anterior recua. */
private fun AnimatedContentTransitionScope<NavBackStackEntry>.sharedAxisIn(forward: Boolean): EnterTransition =
    slideInHorizontally(tween(TRANSITION_MS, easing = LombadaMotion.Easing)) { width ->
        if (forward) width / 5 else -width / 5
    } +
        fadeIn(tween(TRANSITION_MS, easing = LombadaMotion.Easing))

private fun AnimatedContentTransitionScope<NavBackStackEntry>.sharedAxisOut(forward: Boolean): ExitTransition =
    slideOutHorizontally(tween(TRANSITION_MS, easing = LombadaMotion.Easing)) { width ->
        if (forward) -width / 5 else width / 5
    } +
        fadeOut(tween(TRANSITION_MS / 2, easing = LombadaMotion.Easing))
