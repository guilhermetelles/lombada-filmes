package io.github.guilhermetelles.lombada.ui.main

import io.github.guilhermetelles.lombada.data.model.RouteRef

/**
 * Converte a rota de um item do feed ou de um push na rota de navegação.
 *
 * @receiver Rota vinda do backend.
 * @return A rota de `Routes.kt`, ou null quando falta um argumento obrigatório ou o nome é desconhecido.
 */
fun RouteRef.toRoute(): Any? = when (name) {
    // Título e nome vazios: as telas completam pelo Firestore.
    "movie" -> args.tmdbId?.let { MovieRoute(tmdbId = it, title = "") }

    "person" -> args.personId?.let { PersonRoute(personId = it, name = "") }

    "quiz" -> QuizRoute

    "quizPlay" -> QuizPlayRoute(day = args.day)

    "queue" -> QueueRoute

    "recs" -> RecsRoute

    "feed" -> FeedRoute

    "listInfo" -> ListInfoRoute

    "retro" -> args.month?.let { RetroRoute(month = it) }

    "duel" -> DuelRoute(entryIdA = args.entryId, entryIdB = args.entryIdB)

    "memory" -> MemoryRoute(entryId = args.entryId)

    "reports" -> ReportsRoute

    else -> null
}
