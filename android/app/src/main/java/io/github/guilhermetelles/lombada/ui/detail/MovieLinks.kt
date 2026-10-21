package io.github.guilhermetelles.lombada.ui.detail

import android.net.Uri

/** Endereços das páginas externas de um filme, como no mock. */
object MovieLinks {
    /**
     * Página no IMDb, ou a busca quando não há id.
     *
     * @param imdbId Id do IMDb.
     * @param title Título.
     * @param year Ano.
     * @return URL.
     */
    fun imdb(imdbId: String?, title: String, year: Int?): String = imdbId?.let { "https://www.imdb.com/title/$it/" }
        ?: "https://www.imdb.com/find/?q=${Uri.encode("$title ${year ?: ""}".trim())}"

    /**
     * Página no Letterboxd; sem o endereço salvo, o Letterboxd redireciona pelo id do TMDb.
     *
     * @param url Endereço salvo.
     * @param tmdbId Filme.
     * @return URL.
     */
    fun letterboxd(url: String?, tmdbId: Int): String = url ?: "https://letterboxd.com/tmdb/$tmdbId/"

    /**
     * Página no Rotten Tomatoes, ou a busca.
     *
     * @param url Endereço vindo da OMDb.
     * @param title Título.
     * @return URL.
     */
    fun rottenTomatoes(url: String?, title: String): String =
        url ?: "https://www.rottentomatoes.com/search?search=${Uri.encode(title)}"

    /**
     * Busca no Metacritic.
     *
     * @param title Título.
     * @return URL.
     */
    fun metacritic(title: String): String = "https://www.metacritic.com/search/${Uri.encode(title)}/?category=2"

    /**
     * Vídeo no YouTube (abre o app do YouTube quando instalado).
     *
     * @param key Id do vídeo.
     * @return URL.
     */
    fun youtube(key: String): String = "https://www.youtube.com/watch?v=$key"

    /**
     * Miniatura do vídeo no YouTube (480×360, com faixas pretas em cima e embaixo; a tela recorta).
     *
     * @param key Id do vídeo.
     * @return URL da imagem.
     */
    fun youtubeThumbnail(key: String): String = "https://i.ytimg.com/vi/$key/hqdefault.jpg"

    /**
     * Página de uma pessoa no TMDb.
     *
     * @param personId Pessoa.
     * @return URL.
     */
    fun tmdbPerson(personId: Int): String = "https://www.themoviedb.org/person/$personId"

    /**
     * Página de um filme no TMDb.
     *
     * @param tmdbId Filme.
     * @return URL.
     */
    fun tmdbMovie(tmdbId: Int): String = "https://www.themoviedb.org/movie/$tmdbId"

    /**
     * Página de uma pessoa no IMDb.
     *
     * @param imdbId Id da pessoa.
     * @return URL.
     */
    fun imdbPerson(imdbId: String): String = "https://www.imdb.com/name/$imdbId/"

    /**
     * Página do filme no bechdeltest.com; sem o endereço salvo, o site redireciona pelo id.
     *
     * @param url Endereço salvo.
     * @param siteId Id do filme no site.
     * @return URL.
     */
    fun bechdel(url: String?, siteId: Int): String = url ?: "https://bechdeltest.com/view/$siteId/"
}
