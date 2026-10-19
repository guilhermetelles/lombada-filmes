package io.github.guilhermetelles.lombada.data.firestore

import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.domain.MovieTitles
import io.github.guilhermetelles.lombada.domain.TitleLanguage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.shareIn

/**
 * Ranking de cada lista com os títulos no idioma escolhido, compartilhado pelas telas: um listener
 * das entradas e, em português, um dos `movies/` da lista (para `titlePt`), por lista aberta.
 *
 * @param entries Entradas.
 * @param movies Filmes.
 * @param language Idioma escolhido.
 * @param scope Escopo do app, onde os fluxos compartilhados vivem.
 */
class ListRankings(
    private val entries: EntryRepository,
    private val movies: MovieRepository,
    private val language: StateFlow<TitleLanguage>,
    private val scope: CoroutineScope
) {
    private val cache = mutableMapOf<String, Flow<List<Entry>>>()

    /**
     * Acompanha o ranking de uma lista, com o título de cada entrada no idioma escolhido.
     *
     * @param listId Lista.
     * @return Fluxo com as entradas ordenadas por `rankKey`.
     */
    fun observe(listId: String): Flow<List<Entry>> = synchronized(cache) {
        cache.getOrPut(listId) { localized(listId) }
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    private fun localized(listId: String): Flow<List<Entry>> {
        val ranking = entries.observeRanking(listId)
        val ids = ranking.map { list -> list.map { it.tmdbId }.toSet() }.distinctUntilChanged()
        val portuguese =
            combine(ids, language, ::Pair)
                .flatMapLatest { (tmdbIds, lang) ->
                    if (lang == TitleLanguage.English) {
                        flowOf(emptyMap())
                    } else {
                        // Até os filmes chegarem, as entradas saem com o título gravado (inglês).
                        movies
                            .observeMany(tmdbIds)
                            .map { byId -> byId.mapNotNull { (id, movie) -> movie.titlePt?.let { id to it } }.toMap() }
                            .onStart { emit(emptyMap()) }
                    }
                }.distinctUntilChanged()
        return combine(ranking, portuguese, language) { list, titles, lang -> MovieTitles.localize(list, titles, lang) }
            // Fica vivo 5 s sem ninguém olhando, para a troca de tela não refazer os listeners.
            .shareIn(scope, SharingStarted.WhileSubscribed(5_000), replay = 1)
    }
}
