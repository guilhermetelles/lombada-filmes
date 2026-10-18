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
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Quiz
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import io.github.guilhermetelles.lombada.AppContainer
import io.github.guilhermetelles.lombada.data.model.MovieList
import io.github.guilhermetelles.lombada.notify.DeviceRegistration
import io.github.guilhermetelles.lombada.notify.PushRouter
import io.github.guilhermetelles.lombada.notify.PushStep
import io.github.guilhermetelles.lombada.notify.PushTarget
import io.github.guilhermetelles.lombada.ui.about.AboutScreen
import io.github.guilhermetelles.lombada.ui.advsearch.AdvancedSearchEntry
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.detail.MovieDetailScreen
import io.github.guilhermetelles.lombada.ui.duel.DuelEntry
import io.github.guilhermetelles.lombada.ui.feed.FeedEntry
import io.github.guilhermetelles.lombada.ui.list.EntrySheet
import io.github.guilhermetelles.lombada.ui.list.ListScreen
import io.github.guilhermetelles.lombada.ui.list.ListViewModel
import io.github.guilhermetelles.lombada.ui.listinfo.ListInfoEntry
import io.github.guilhermetelles.lombada.ui.memory.MemoryEntry
import io.github.guilhermetelles.lombada.ui.notify.NotifySettingsEntry
import io.github.guilhermetelles.lombada.ui.person.PersonScreen
import io.github.guilhermetelles.lombada.ui.queue.QueueEntry
import io.github.guilhermetelles.lombada.ui.quiz.QuizEntry
import io.github.guilhermetelles.lombada.ui.quiz.QuizPlayEntry
import io.github.guilhermetelles.lombada.ui.recs.RecsEntry
import io.github.guilhermetelles.lombada.ui.reports.CriticsScreen
import io.github.guilhermetelles.lombada.ui.reports.ReportsScreen
import io.github.guilhermetelles.lombada.ui.reports.UsageScreen
import io.github.guilhermetelles.lombada.ui.retro.RetroEntry
import io.github.guilhermetelles.lombada.ui.roulette.RouletteEntry
import io.github.guilhermetelles.lombada.ui.search.SearchViewModel
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import io.github.guilhermetelles.lombada.ui.theme.LombadaMotion
import kotlin.reflect.KClass
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.transformLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

private const val TRANSITION_MS = 300

// Quanto sair da conta espera o backend tirar o token antes de seguir sem ele.
private const val SIGN_OUT_TIMEOUT_MS = 5_000L

/**
 * App com uma lista aberta: as cinco abas, a navegação entre as telas e as folhas de registrar e
 * editar, que abrem por cima de qualquer tela. Cada tela nova recebe um [ScreenContext].
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
    val currentTab = destination?.let { dest -> TABS.firstOrNull { dest.hasRoute(it.routeClass) } }
    val showTabs = destination == null || currentTab != null
    val queueFlow =
        remember(list.id) { container.queue.observe(list.id).map { items -> items.map { it.tmdbId } }.catch {} }
    val queueIds by queueFlow.collectAsStateWithLifecycle(initialValue = emptyList())
    // A fila esconde os filmes que já estão na lista.
    val queueCount = queueIds.count { it !in state.entryByTmdbId }
    val members = remember(list) { list.memberUids.mapNotNull { list.memberProfiles[it] } }
    val unseenFlow = remember(list.id, uid) { unseenFeedCount(container, list.id, uid) }
    val unseenCount by unseenFlow.collectAsStateWithLifecycle(initialValue = 0L)
    val pendingPush by PushRouter.pending.collectAsStateWithLifecycle()
    // Sair da conta tira antes o token do backend, enquanto ainda há sessão para autenticar.
    val signOut: () -> Unit =
        remember(onSignOut) {
            {
                container.appScope.launch {
                    withTimeoutOrNull(SIGN_OUT_TIMEOUT_MS) { DeviceRegistration(container.backend).unregister() }
                    StartupSync.forget()
                    onSignOut()
                }
            }
        }
    val context =
        remember(list, uid, listViewModel, navController) {
            ScreenContext(
                list = list,
                uid = uid,
                listViewModel = listViewModel,
                navigate = { route -> navController.navigateTo(route) },
                back = { navController.popBackStack() }
            )
        }

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
                    onSignOut = signOut,
                    topBarActions = {
                        ListTopActions(
                            unseenCount = unseenCount.toInt(),
                            members = members,
                            onOpenFeed = { navController.navigate(FeedRoute) },
                            onOpenListInfo = { navController.navigate(ListInfoRoute) }
                        )
                    }
                )
            }
            composable<QueueRoute> { QueueEntry(context) }
            composable<RecsRoute> { RecsEntry(context) }
            composable<QuizRoute> { QuizEntry(context) }
            composable<QuizPlayRoute> { entry -> QuizPlayEntry(context, entry.toRoute<QuizPlayRoute>()) }
            composable<FeedRoute> { FeedEntry(context) }
            composable<ListInfoRoute> { ListInfoEntry(context) }
            composable<MemoryRoute> { entry -> MemoryEntry(context, entry.toRoute<MemoryRoute>()) }
            composable<RetroRoute> { entry -> RetroEntry(context, entry.toRoute<RetroRoute>()) }
            composable<DuelRoute> { entry -> DuelEntry(context, entry.toRoute<DuelRoute>()) }
            composable<AdvancedSearchRoute> { AdvancedSearchEntry(context) }
            composable<RouletteRoute> { RouletteEntry(context) }
            composable<NotifySettingsRoute> { NotifySettingsEntry(context) }
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
            composable<AboutRoute> { AboutScreen(onBack = { navController.popBackStack() }, onSignOut = signOut) }
        }
        if (showTabs) {
            Tabs(
                current = currentTab ?: TABS.first(),
                queueCount = queueCount,
                onSelect = { tab -> if (tab != currentTab) navController.navigateTo(tab.route) }
            )
        }
    }

    // Ao entrar: token do FCM e nome e foto em memberProfiles, uma vez por processo, sem esperar.
    LaunchedEffect(uid) { StartupSync.run(container, uid) }

    // Toque num aviso: troca para a lista do aviso, se for outra, e abre a tela dele.
    LaunchedEffect(pendingPush) {
        val target = pendingPush ?: return@LaunchedEffect
        val otherList = target.listId?.takeIf { it != list.id }
        val memberIds =
            otherList?.let { runCatching { container.lists.fetchMine(uid).map { it.id }.toSet() }.getOrNull() }
        when (val step = PushRouter.stepFor(target, list.id, memberIds)) {
            // O MainScreen da outra lista recebe o mesmo destino e abre a tela.
            is PushStep.SwitchList ->
                if (runCatching { container.users.visit(uid, step.listId) }.isFailure) {
                    navController.openPush(target)
                }

            PushStep.Open -> navController.openPush(target)
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

/**
 * Abre a tela de um aviso e o marca como aberto. Sem rota (ou com rota desconhecida), fica onde está.
 *
 * @param target Destino do aviso.
 */
private fun NavHostController.openPush(target: PushTarget) {
    PushRouter.consume(target)
    val route = target.route?.toRoute() ?: return
    if (TABS.any { it.route == route }) {
        navigateTo(route)
    } else {
        // O mesmo aviso tocado duas vezes não empilha a mesma tela.
        navigate(route) { launchSingleTop = true }
    }
}

/**
 * Número do sino: itens do feed depois de `feedSeenAt`, recontados (`count()`) quando chega item novo
 * ou a pessoa abre a Atividade. Sem rede, mantém o último número.
 *
 * @param container Dependências do app.
 * @param listId Lista.
 * @param uid Pessoa logada.
 * @return Fluxo com o número.
 */
@OptIn(ExperimentalCoroutinesApi::class)
private fun unseenFeedCount(container: AppContainer, listId: String, uid: String): Flow<Long> = combine(
    container.users.observeFeedSeenAt(uid, listId),
    container.feed.observe(listId, limit = 1)
) { seenAt, latest -> seenAt to latest.firstOrNull() }
    .distinctUntilChanged { old, new -> old.first == new.first && old.second?.id == new.second?.id }
    .transformLatest { (seenAt, latest) ->
        val latestAt = latest?.createdAt
        when {
            latest == null -> emit(0L)

            // O mais novo já foi visto: zero, sem consultar o servidor.
            seenAt != null && latestAt != null && !latestAt.isAfter(seenAt) -> emit(0L)

            else -> runCatching { container.feed.countSince(listId, seenAt) }.onSuccess { emit(it) }
        }
    }.catch {}

/** O que roda uma vez por processo e pessoa ao entrar, mesmo trocando de lista. */
private object StartupSync {
    @Volatile
    private var syncedUid: String? = null

    /**
     * Registra o token do FCM e chama `GET /api/me`, que sincroniza nome e foto nas listas. Roda no
     * escopo do app: trocar de lista no meio não cancela.
     *
     * @param container Dependências do app.
     * @param uid Pessoa logada.
     */
    fun run(container: AppContainer, uid: String) {
        container.appScope.launch { DeviceRegistration(container.backend).registerOnce(uid) }
        if (syncedUid == uid) return
        syncedUid = uid
        container.appScope.launch {
            // Falhou (sem rede): tenta de novo na próxima vez que o MainScreen abrir.
            runCatching { container.backend.me() }.onFailure { if (syncedUid == uid) syncedUid = null }
        }
    }

    /** Esquece a pessoa, ao sair da conta. */
    fun forget() {
        syncedUid = null
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

private fun countLabel(count: Int): String = if (count == 1) "1 filme" else "$count filmes"

/**
 * Uma aba da navigation bar.
 *
 * @property route Rota da aba.
 * @property routeClass Classe da rota, para reconhecer a aba atual.
 * @property label Rótulo.
 * @property icon Ícone.
 */
private class Tab(val route: Any, val routeClass: KClass<*>, val label: String, val icon: ImageVector)

/** As cinco abas, na ordem da barra. */
private val TABS =
    listOf(
        Tab(ListRoute, ListRoute::class, "Lista", Icons.AutoMirrored.Filled.List),
        Tab(QueueRoute, QueueRoute::class, "Quero ver", Icons.Filled.Bookmark),
        Tab(RecsRoute, RecsRoute::class, "Sugestões", Icons.Filled.AutoAwesome),
        Tab(QuizRoute, QuizRoute::class, "Quiz", Icons.Filled.Quiz),
        Tab(ReportsRoute, ReportsRoute::class, "Relatórios", Icons.Filled.BarChart)
    )

/**
 * Navega para uma rota; as das abas trocam de aba, guardando o estado de cada uma.
 *
 * @param route Rota de `Routes.kt`.
 */
private fun NavHostController.navigateTo(route: Any) {
    if (TABS.none { it.route == route }) {
        navigate(route)
        return
    }
    navigate(route) {
        popUpTo(graph.findStartDestination().id) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}

/**
 * Navigation bar com as cinco abas: indicador tonal e ícone amarelo na aba ativa; "Quero ver" com
 * a quantidade de filmes na fila.
 *
 * @param current Aba ativa.
 * @param queueCount Filmes na fila que ainda não estão na lista; 0 esconde o contador.
 * @param onSelect Escolhe a aba.
 */
@Composable
private fun Tabs(current: Tab, queueCount: Int, onSelect: (Tab) -> Unit) {
    val colors =
        NavigationBarItemDefaults.colors(
            selectedIconColor = LombadaColors.Sticker,
            selectedTextColor = LombadaColors.Paper,
            indicatorColor = LombadaColors.Tonal,
            unselectedIconColor = LombadaColors.Paper2,
            unselectedTextColor = LombadaColors.Paper2
        )
    NavigationBar(containerColor = LombadaColors.Shelf) {
        TABS.forEach { tab ->
            val badge = if (tab.route == QueueRoute) queueCount else 0
            NavigationBarItem(
                selected = tab == current,
                onClick = { onSelect(tab) },
                icon = {
                    BadgedBox(
                        badge = {
                            if (badge > 0) {
                                Badge(containerColor = LombadaColors.Sticker, contentColor = LombadaColors.StickerInk) {
                                    Text(badge.toString())
                                }
                            }
                        }
                    ) { Icon(tab.icon, contentDescription = if (badge > 0) countLabel(badge) else null) }
                },
                label = { Text(tab.label, maxLines = 1) },
                colors = colors
            )
        }
    }
}
