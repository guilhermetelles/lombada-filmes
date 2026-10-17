package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.CastMember
import io.github.guilhermetelles.lombada.data.model.Entry
import io.github.guilhermetelles.lombada.data.model.Movie

/**
 * Um filme da lista com a pessoa.
 *
 * @property entry Entrada.
 * @property position Posição no ranking.
 * @property score Nota de vocês.
 * @property directed Se a pessoa dirigiu.
 * @property character Personagem, se atuou.
 */
data class PersonFilm(
    val entry: Entry,
    val position: Int,
    val score: Double,
    val directed: Boolean,
    val character: String?
)

/**
 * "Na lista de vocês" de uma pessoa, a partir só dos dados dos filmes (diretores da cópia resumida
 * e elenco de `movies/{tmdbId}`), sem a ficha completa: funciona sem internet.
 */
object PersonInList {
    /**
     * Filmes da lista com a pessoa, na ordem do ranking.
     *
     * @param personId Pessoa no TMDb.
     * @param ranking Entradas na ordem do ranking.
     * @param castByMovie Elenco de cada filme.
     * @return Os filmes, com o papel da pessoa em cada um.
     */
    fun films(personId: Int, ranking: List<Entry>, castByMovie: Map<Int, List<CastMember>>): List<PersonFilm> =
        ranking.mapIndexedNotNull { index, entry ->
            val directed = entry.movie.directors.any { it.id == personId }
            val cast = castByMovie[entry.tmdbId].orEmpty().firstOrNull { it.id == personId }
            if (!directed && cast == null) return@mapIndexedNotNull null
            PersonFilm(entry, index + 1, CoupleScore.of(index + 1, ranking.size), directed, cast?.character)
        }

    /**
     * Foto da pessoa tirada dos filmes (elenco ou diretores), para a primeira etapa da tela.
     *
     * @param personId Pessoa.
     * @param movies Filmes da lista.
     * @return Caminho da foto, se algum filme tiver.
     */
    fun photo(personId: Int, movies: Collection<Movie>): String? = movies.firstNotNullOfOrNull { movie ->
        movie.cast.firstOrNull { it.id == personId }?.profilePath
            ?: movie.directors.firstOrNull { it.id == personId }?.profilePath
    }
}
