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
 * Teste de Bechdel do filme segundo o bechdeltest.com, em `movies/{tmdbId}.bechdel`.
 *
 * @property siteId Id do filme no site; null quando o filme não está lá.
 * @property url Página do filme no site.
 * @property rating Quantos dos 3 critérios o filme passa, de 0 a 3; null fora do site.
 * @property dubious Se o site marca a avaliação como duvidosa.
 * @property disputes Quantas pessoas contestaram a avaliação nos comentários do site.
 * @property fetchedAt Quando o backend leu a página do filme.
 */
data class Bechdel(
    val siteId: Int?,
    val url: String?,
    val rating: Int?,
    val dubious: Boolean,
    val disputes: Int,
    val fetchedAt: Instant?
) {
    /** Se o filme tem avaliação no site, com os critérios. */
    val isRated: Boolean get() = siteId != null && rating != null

    /** Se passa nos 3 critérios. */
    val passes: Boolean get() = isRated && rating == CRITERIA

    companion object {
        /** Quantidade de critérios do teste. */
        const val CRITERIA = 3
    }
}

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
 * @property bechdel Teste de Bechdel; null quando o backend ainda não buscou.
 * @property titlePt Título no Brasil.
 * @property tagline Slogan em português.
 * @property budget Orçamento em US$.
 * @property revenue Bilheteria mundial em US$.
 * @property boxOfficeUS Bilheteria nos EUA em US$ (OMDb).
 * @property certBR Classificação indicativa no Brasil.
 * @property collection Coleção (saga) do TMDb.
 * @property keywords Até 25 palavras-chave do TMDb, em inglês.
 * @property recs Até 10 ids de filmes recomendados pelo TMDb.
 * @property recsInfo Título, ano e capa dos mesmos filmes de [recs], para a fileira de parecidos.
 * @property providersBR Streaming por assinatura no Brasil.
 * @property awards Prêmios e indicações.
 * @property popularity Popularidade no TMDb.
 * @property vote Nota média no TMDb, de 0 a 10.
 * @property votes Quantidade de votos no TMDb.
 * @property extraFetchedAt Quando os campos extras (de [titlePt] em diante) foram buscados.
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
    val missingDirectorPhotos: Boolean = false,
    val bechdel: Bechdel? = null,
    val titlePt: String? = null,
    val tagline: String? = null,
    val budget: Long? = null,
    val revenue: Long? = null,
    val boxOfficeUS: Long? = null,
    val certBR: String? = null,
    val collection: MovieCollection? = null,
    val keywords: List<String> = emptyList(),
    val recs: List<Int> = emptyList(),
    val recsInfo: List<MovieRecInfo> = emptyList(),
    val providersBR: ProvidersBR? = null,
    val awards: Awards? = null,
    val popularity: Double? = null,
    val vote: Double? = null,
    val votes: Int? = null,
    val extraFetchedAt: Instant? = null
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

/**
 * Um filme recomendado pelo TMDb, em `movies/{tmdbId}.recsInfo`.
 *
 * @property tmdbId Filme.
 * @property title Título (em português quando o TMDb tem).
 * @property year Ano.
 * @property posterPath Capa.
 */
data class MovieRecInfo(val tmdbId: Int, val title: String, val year: Int?, val posterPath: String?)
