package io.github.guilhermetelles.lombada.data.model

import java.time.Instant

/**
 * Diretor em `movies/{tmdbId}.directors`.
 *
 * @property id Id da pessoa no TMDb.
 * @property name Nome.
 * @property profilePath Foto; null quando o TMDb não tem ou o filme ainda não foi atualizado.
 */
data class Director(val id: Int, val name: String, val profilePath: String?)

/**
 * Ator em `movies/{tmdbId}.cast`, na ordem dos créditos.
 *
 * @property id Id da pessoa no TMDb.
 * @property name Nome.
 * @property character Personagem, se informado.
 * @property profilePath Foto, se houver.
 */
data class CastMember(val id: Int, val name: String, val character: String?, val profilePath: String?)

/**
 * Uma nota externa e quando foi buscada.
 *
 * @property value Nota, ou null quando a fonte não tem.
 * @property fetchedAt Quando o backend buscou.
 * @property url Página da nota, quando a fonte informa (Rotten Tomatoes).
 */
data class Rating(val value: Double?, val fetchedAt: Instant?, val url: String? = null)

/**
 * Filme em `movies/{tmdbId}`, escrito só pelo backend.
 *
 * @property tmdbId Id no TMDb.
 * @property title Título em inglês.
 * @property year Ano.
 * @property directors Diretores, com foto quando já atualizados.
 * @property cast Os 12 primeiros do elenco.
 * @property runtime Duração em minutos.
 * @property genres Gêneros em português.
 * @property synopsisPt Sinopse em português.
 * @property synopsisEn Sinopse em inglês.
 * @property posterPath Capa.
 * @property imdbId Id do IMDb.
 * @property letterboxdUrl Página do filme no Letterboxd.
 * @property letterboxd Nota do Letterboxd, de 0 a 5.
 * @property imdb Nota do IMDb, de 0 a 10.
 * @property rottenTomatoes Tomatômetro, de 0 a 100.
 * @property metacritic Metascore, de 0 a 100.
 * @property tmdbFetchedAt Quando os dados do TMDb foram buscados.
 * @property missingDirectorPhotos Se algum diretor está no formato antigo, sem o campo de foto; o
 *   backend completa na próxima abertura do filme.
 */
data class Movie(
    val tmdbId: Int,
    val title: String,
    val year: Int?,
    val directors: List<Director>,
    val cast: List<CastMember>,
    val runtime: Int?,
    val genres: List<String>,
    val synopsisPt: String?,
    val synopsisEn: String?,
    val posterPath: String?,
    val imdbId: String?,
    val letterboxdUrl: String?,
    val letterboxd: Rating?,
    val imdb: Rating?,
    val rottenTomatoes: Rating?,
    val metacritic: Rating?,
    val tmdbFetchedAt: Instant?,
    val missingDirectorPhotos: Boolean = false
) {
    /** Cópia resumida para gravar numa entrada nova. */
    fun toSnapshot(): MovieSnapshot = MovieSnapshot(
        title = title,
        year = year,
        posterPath = posterPath,
        imdb = imdb?.value,
        letterboxd = letterboxd?.value,
        directors = directors.take(8).map { PersonRef(it.id, it.name) }
    )
}
