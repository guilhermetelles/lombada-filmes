package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.Movie
import io.github.guilhermetelles.lombada.data.model.MovieRecInfo
import io.github.guilhermetelles.lombada.data.model.RecItem

/**
 * Idioma em que o app mostra os títulos dos filmes, escolhido em "Opções".
 *
 * @property key Valor guardado no aparelho.
 */
enum class TitleLanguage(val key: String) {
    /** Título no Brasil, quando o TMDb tem (padrão). */
    Portuguese("pt"),

    /** Título em inglês (ou o original). */
    English("en");

    /** Valor do parâmetro `lang` das rotas do backend: `en` em inglês, nada em português (o padrão). */
    val apiParam: String? get() = if (this == English) "en" else null

    companion object {
        /** Idioma de quem nunca escolheu. */
        val DEFAULT = Portuguese

        /**
         * Lê o valor guardado.
         *
         * @param key Valor de [key], ou null.
         * @return O idioma; [DEFAULT] quando o valor é desconhecido.
         */
        fun fromKey(key: String?): TitleLanguage = entries.firstOrNull { it.key == key } ?: DEFAULT
    }
}

/**
 * Regra única de qual título mostrar. Todo lugar do app que mostra um título vindo do app (não um
 * texto pronto do servidor) passa por aqui.
 */
object MovieTitles {
    /**
     * Título no idioma escolhido, caindo no outro quando falta.
     *
     * @param english Título em inglês (ou original).
     * @param portuguese Título no Brasil, ou null.
     * @param language Idioma escolhido.
     * @return O título a mostrar.
     */
    fun pick(english: String?, portuguese: String?, language: TitleLanguage): String {
        val en = english?.trim().orEmpty()
        val pt = portuguese?.trim().orEmpty()
        return when (language) {
            TitleLanguage.Portuguese -> pt.ifEmpty { en }
            TitleLanguage.English -> en.ifEmpty { pt }
        }
    }

    /**
     * O título no outro idioma, para um subtítulo menor.
     *
     * @param english Título em inglês (ou original).
     * @param portuguese Título no Brasil, ou null.
     * @param language Idioma escolhido.
     * @return O outro título, ou null quando falta ou é igual (sem diferença de maiúsculas) ao principal.
     */
    fun other(english: String?, portuguese: String?, language: TitleLanguage): String? {
        val shown = pick(english, portuguese, language)
        val candidate = if (language == TitleLanguage.Portuguese) english else portuguese
        return candidate?.trim()?.takeIf { it.isNotEmpty() && !it.equals(shown, ignoreCase = true) }
    }

    /**
     * Título de um filme de `movies/`.
     *
     * @param movie Filme (`title` em inglês, `titlePt` no Brasil).
     * @param language Idioma escolhido.
     * @return O título a mostrar.
     */
    fun of(movie: Movie, language: TitleLanguage): String = pick(movie.title, movie.titlePt, language)

    /**
     * Título de uma sugestão (`title` em português, `titleEn` em inglês).
     *
     * @param item Sugestão.
     * @param language Idioma escolhido.
     * @return O título a mostrar.
     */
    fun of(item: RecItem, language: TitleLanguage): String = pick(item.titleEn, item.title, language)

    /**
     * Título de um parecido de `movies/{id}.recsInfo` (`title` em português, `titleEn` em inglês).
     *
     * @param info Parecido.
     * @param language Idioma escolhido.
     * @return O título a mostrar.
     */
    fun of(info: MovieRecInfo, language: TitleLanguage): String = pick(info.titleEn, info.title, language)

    /**
     * Troca o título das entradas pelo do idioma escolhido. O título em inglês da cópia resumida
     * fica em `titleAlt` quando muda, para a busca na lista achar pelos dois.
     *
     * @param entries Entradas como vieram do Firestore (título em inglês).
     * @param portuguese Título no Brasil por tmdbId, de `movies/{id}.titlePt`.
     * @param language Idioma escolhido.
     * @return As entradas com o título a mostrar.
     */
    fun localize(entries: List<Entry>, portuguese: Map<Int, String>, language: TitleLanguage): List<Entry> {
        if (language == TitleLanguage.English || portuguese.isEmpty()) return entries
        return entries.map { entry ->
            val english = entry.movie.title
            val shown = pick(english, portuguese[entry.tmdbId], language)
            if (shown == english) {
                entry
            } else {
                entry.copy(movie = entry.movie.copy(title = shown, titleAlt = english))
            }
        }
    }
}
