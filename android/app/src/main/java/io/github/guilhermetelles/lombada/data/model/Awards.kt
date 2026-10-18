package io.github.guilhermetelles.lombada.data.model

import java.time.Instant

/**
 * Um prêmio ou indicação, em `awards.items` de `movies/{tmdbId}` e `people/{id}`.
 *
 * @property org Premiação: "Oscar", "Framboesa de Ouro", "BAFTA", "Globo de Ouro", "Saturn", "Cannes" ou outra.
 * @property category Categoria, quando a fonte informa.
 * @property kind [KIND_WIN] ou [KIND_NOMINATION].
 * @property year Ano da cerimônia, quando a fonte informa.
 * @property work Por qual filme (prêmios de pessoas), quando a fonte informa; `for` no Firestore.
 */
data class AwardItem(
    val org: String,
    val category: String?,
    val kind: String,
    val year: Int?,
    val work: String? = null
) {
    /** Se é vitória, e não só indicação. */
    val isWin: Boolean get() = kind == KIND_WIN

    companion object {
        /** Vitória. */
        const val KIND_WIN = "win"

        /** Indicação. */
        const val KIND_NOMINATION = "nom"
    }
}

/**
 * Prêmios de um filme ou de uma pessoa, escritos pela rotina `enrich`.
 *
 * @property items Prêmios e indicações, já sem repetidos.
 * @property summary Resumo da OMDb (só filmes), quando houver.
 * @property fetchedAt Quando o backend buscou.
 */
data class Awards(val items: List<AwardItem>, val summary: String?, val fetchedAt: Instant?)
