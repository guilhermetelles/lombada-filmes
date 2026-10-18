package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.DiscoverItem
import io.github.guilhermetelles.lombada.data.model.Filters

/**
 * Grupo de filtros da busca avançada.
 *
 * @property title Título do grupo na tela.
 */
enum class FilterGroup(val title: String) {
    Mood("Humor"),
    Dur("Duração"),
    Dec("Década"),
    Genre("Gênero"),
    Theme("Tema"),
    Svc("Streaming no Brasil")
}

/**
 * Um valor de filtro.
 *
 * @property group Grupo; null é "Só o que combina com vocês" (`fit`).
 * @property id Valor enviado ao backend.
 * @property label Rótulo na tela.
 */
data class FilterOption(val group: FilterGroup?, val id: String, val label: String)

/**
 * Vocabulário e montagem dos filtros da busca avançada. Os valores são os do contrato da versão
 * 0.3 (§2) e do backend (`lib/discover/discover-vocabulary.ts`): gêneros com o nome em pt-BR do
 * TMDb e serviços com o nome do TMDb para o Brasil.
 */
object DiscoverFilters {
    /** Compatibilidade mínima de "Só o que combina com vocês" (`FIT_MIN_SCORE` do backend). */
    const val FIT_MIN_SCORE = 60

    /** Rótulo do filtro `fit`. */
    const val FIT_LABEL = "Só o que combina com vocês"

    private val moods =
        listOf(
            "leve" to "Leve",
            "tenso" to "Tenso",
            "ruim-divertido" to "Ruim divertido",
            "chorar" to "Para chorar",
            "cult" to "Cult"
        )

    private val durations = listOf("ate90" to "Até 90 min", "90a120" to "90 a 120 min", "mais120" to "Mais de 2h")

    private val decades =
        listOf(
            "antes70" to "Antes de 1970",
            "1970" to "Anos 70",
            "1980" to "Anos 80",
            "1990" to "Anos 90",
            "2000" to "Anos 2000",
            "2010" to "Anos 2010",
            "2020" to "Anos 2020"
        )

    // Gêneros do TMDb em pt-BR, como o backend aceita e devolve (sem "Cinema TV").
    private val genres =
        listOf(
            "Comédia",
            "Drama",
            "Ação",
            "Aventura",
            "Animação",
            "Crime",
            "Documentário",
            "Família",
            "Fantasia",
            "Ficção científica",
            "Guerra",
            "História",
            "Faroeste",
            "Mistério",
            "Música",
            "Romance",
            "Terror",
            "Thriller"
        )

    private val themes =
        listOf(
            "lgbt" to "LGBT+",
            "fatos" to "Baseado em fatos",
            "trash" to "Terror trash",
            "tempo" to "Viagem no tempo",
            "golpes" to "Golpes e assaltos",
            "espaco" to "Espaço",
            "zumbis-vampiros" to "Zumbis e vampiros",
            "halloween" to "Halloween",
            "serial-killer" to "Serial killer",
            "livro" to "Baseado em livro"
        )

    // Serviços por assinatura no Brasil, com o nome exato do TMDb (STREAMING_SERVICES do backend).
    private val services =
        listOf(
            "Netflix",
            "Amazon Prime Video",
            "Apple TV",
            "Disney Plus",
            "Claro video",
            "Looke",
            "Paramount Plus",
            "HBO Max",
            "Globoplay",
            "Crunchyroll",
            "MUBI",
            "Belas Artes à La Carte",
            "Oldflix",
            "Libreflix",
            "Pluto TV"
        )

    /**
     * Valores de um grupo, na ordem da tela.
     *
     * @param group Grupo.
     * @return Os valores.
     */
    fun options(group: FilterGroup): List<FilterOption> = when (group) {
        FilterGroup.Mood -> moods.map { (id, label) -> FilterOption(group, id, label) }
        FilterGroup.Dur -> durations.map { (id, label) -> FilterOption(group, id, label) }
        FilterGroup.Dec -> decades.map { (id, label) -> FilterOption(group, id, label) }
        FilterGroup.Genre -> genres.map { FilterOption(group, it, it) }
        FilterGroup.Theme -> themes.map { (id, label) -> FilterOption(group, id, label) }
        FilterGroup.Svc -> services.map { FilterOption(group, it, it) }
    }

    /**
     * Valores escolhidos num grupo.
     *
     * @param filters Filtros.
     * @param group Grupo.
     * @return Os valores, como vão ao backend.
     */
    fun selected(filters: Filters, group: FilterGroup): List<String> = when (group) {
        FilterGroup.Mood -> filters.mood
        FilterGroup.Dur -> filters.dur
        FilterGroup.Dec -> filters.dec
        FilterGroup.Genre -> filters.genre
        FilterGroup.Theme -> filters.theme
        FilterGroup.Svc -> filters.svc
    }

    /**
     * Liga ou desliga um valor; com grupo null, liga ou desliga `fit`.
     *
     * @param filters Filtros atuais.
     * @param option Valor tocado.
     * @return Os filtros novos.
     */
    fun toggle(filters: Filters, option: FilterOption): Filters {
        val group = option.group ?: return filters.copy(fit = !filters.fit)
        val current = selected(filters, group)
        val next = if (option.id in current) current - option.id else current + option.id
        return replace(filters, group, next)
    }

    /**
     * Deixa só valores conhecidos, sem repetidos, como os botões da tela. Usado na resposta do
     * `interpret`, para os chips baterem com os botões.
     *
     * @param filters Filtros recebidos.
     * @return Filtros limpos.
     */
    fun clean(filters: Filters): Filters = FilterGroup.entries.fold(filters) { acc, group ->
        val known = options(group).map { it.id }.toSet()
        replace(acc, group, selected(acc, group).filter { it in known }.distinct())
    }

    /**
     * Soma os filtros entendidos no texto livre aos que já estavam ligados: união por grupo, sem
     * repetir, com os de antes primeiro; `fit` fica ligado se estava em qualquer um.
     *
     * @param current Filtros já ligados.
     * @param added Filtros novos.
     * @return Os dois juntos.
     */
    fun union(current: Filters, added: Filters): Filters =
        FilterGroup.entries.fold(current.copy(fit = current.fit || added.fit)) { acc, group ->
            replace(acc, group, (selected(current, group) + selected(added, group)).distinct())
        }

    /**
     * Valores ligados, na ordem dos grupos, com `fit` por último: os chips do que foi entendido.
     *
     * @param filters Filtros.
     * @return Os valores ligados.
     */
    fun active(filters: Filters): List<FilterOption> {
        val chosen =
            FilterGroup.entries.flatMap { group ->
                val labels = options(group).associate { it.id to it.label }
                selected(filters, group).map { FilterOption(group, it, labels[it] ?: it) }
            }
        return if (filters.fit) chosen + FilterOption(null, "fit", FIT_LABEL) else chosen
    }

    /**
     * Texto da contagem de resultados.
     *
     * @param filters Filtros.
     * @param keywordCount Palavras-chave ligadas, que contam como filtros.
     * @return "sem filtros", "com 1 filtro" ou "com 3 filtros".
     */
    fun filtersLabel(filters: Filters, keywordCount: Int = 0): String {
        val count = active(filters).size + keywordCount
        return if (count == 0) "sem filtros" else "com ${Formatting.count(count, "filtro", "filtros")}"
    }

    private fun replace(filters: Filters, group: FilterGroup, values: List<String>): Filters = when (group) {
        FilterGroup.Mood -> filters.copy(mood = values)
        FilterGroup.Dur -> filters.copy(dur = values)
        FilterGroup.Dec -> filters.copy(dec = values)
        FilterGroup.Genre -> filters.copy(genre = values)
        FilterGroup.Theme -> filters.copy(theme = values)
        FilterGroup.Svc -> filters.copy(svc = values)
    }
}

/** Montagem dos resultados da busca avançada, página a página. */
object DiscoverResults {
    /**
     * Junta uma página nova às anteriores: a página entra com os filmes de mais palavras-chave
     * primeiro e depois pela compatibilidade (no empate, na ordem do backend), sem repetir filmes
     * já mostrados, e as anteriores não mudam de lugar.
     *
     * @param shown Resultados já mostrados.
     * @param page Resultados da página nova.
     * @return Todos os resultados.
     */
    fun append(shown: List<DiscoverItem>, page: List<DiscoverItem>): List<DiscoverItem> {
        val seen = shown.map { it.tmdbId }.toMutableSet()
        val order = compareByDescending<DiscoverItem> { it.matchedKeywords.size }.thenByDescending { it.score }
        return shown + page.sortedWith(order).filter { seen.add(it.tmdbId) }
    }

    /**
     * Posição do filme na lista, quando ele já é uma entrada.
     *
     * @param item Resultado.
     * @param positions Posição de cada entrada.
     * @return A posição, ou null fora da lista.
     */
    fun position(item: DiscoverItem, positions: Map<String, Int>): Int? = item.inListEntryId?.let(positions::get)
}
