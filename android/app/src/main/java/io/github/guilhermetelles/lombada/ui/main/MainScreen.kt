package io.github.guilhermetelles.lombada.ui.main

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import io.github.guilhermetelles.lombada.data.model.MovieList
import io.github.guilhermetelles.lombada.ui.about.AboutScreen
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.detail.MovieDetailScreen
import io.github.guilhermetelles.lombada.ui.list.EntrySheet
import io.github.guilhermetelles.lombada.ui.list.ListScreen
import io.github.guilhermetelles.lombada.ui.list.ListViewModel
import io.github.guilhermetelles.lombada.ui.person.PersonScreen
import io.github.guilhermetelles.lombada.ui.reports.CriticsScreen
import io.github.guilhermetelles.lombada.ui.reports.ReportsScreen
import io.github.guilhermetelles.lombada.ui.reports.UsageScreen
import io.github.guilhermetelles.lombada.ui.search.SearchViewModel
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
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
    val current by navController.currentBackStackEntryAsState()
    val destination = current?.destination
    val onReports = destination?.hasRoute(ReportsRoute::class) == true
    val showTabs = destination == null || destination.hasRoute(ListRoute::class) || onReports

    Column(Modifier.fillMaxSize()) {
        NavHost(
            navController = navController,
            modifier =
                Modifier
                    .weight(1f)
                    .then(if (showTabs) Modifier.consumeWindowInsets(WindowInsets.navigationBars) else Modifier),
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
                    onAbout = { navController.navigate(AboutRoute) },
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
                PersonScreen(
                    route = entry.toRoute<PersonRoute>(),
                    listId = list.id,
                    onBack = { navController.popBackStack() },
                    onOpenMovie = { navController.navigate(it) }
                )
            }
            composable<ReportsRoute> {
                ReportsScreen(
                    listId = list.id,
                    onOpenMovie = { navController.navigate(it) },
                    onOpenPerson = { navController.navigate(it) },
                    onOpenCritics = { navController.navigate(CriticsRoute) },
                    onOpenUsage = { navController.navigate(UsageRoute) }
                )
            }
            composable<CriticsRoute> {
                CriticsScreen(listId = list.id, onBack = {
                    navController.popBackStack()
                }, onOpenMovie = { navController.navigate(it) })
            }
            composable<UsageRoute> { UsageScreen(onBack = { navController.popBackStack() }) }
            composable<AboutRoute> { AboutScreen(onBack = { navController.popBackStack() }, onSignOut = onSignOut) }
        }
        if (showTabs) {
            Tabs(
                onReports = onReports,
                onSelect = { reports ->
                    if (reports != onReports) {
                        navController.navigate(if (reports) ReportsRoute else ListRoute) {
                            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                }
            )
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

/**
 * Navigation bar com "Lista" e "Relatórios": indicador tonal e ícone amarelo na aba ativa.
 *
 * @param onReports Se a aba de relatórios está ativa.
 * @param onSelect Escolhe a aba (true para relatórios).
 */
@Composable
private fun Tabs(onReports: Boolean, onSelect: (Boolean) -> Unit) {
    val colors =
        NavigationBarItemDefaults.colors(
            selectedIconColor = LombadaColors.Sticker,
            selectedTextColor = LombadaColors.Paper,
            indicatorColor = LombadaColors.Tonal,
            unselectedIconColor = LombadaColors.Paper2,
            unselectedTextColor = LombadaColors.Paper2
        )
    NavigationBar(containerColor = LombadaColors.Shelf) {
        NavigationBarItem(
            selected = !onReports,
            onClick = { onSelect(false) },
            icon = { Icon(Icons.AutoMirrored.Filled.List, contentDescription = null) },
            label = { Text("Lista") },
            colors = colors
        )
        NavigationBarItem(
            selected = onReports,
            onClick = { onSelect(true) },
            icon = { Icon(Icons.Filled.BarChart, contentDescription = null) },
            label = { Text("Relatórios") },
            colors = colors
        )
    }
}
