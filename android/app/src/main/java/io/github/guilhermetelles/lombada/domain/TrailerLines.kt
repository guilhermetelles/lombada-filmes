package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.MovieTrailer

/** Textos do bloco "Trailer" da página do filme, como no mock. */
object TrailerLines {
    /**
     * Linha embaixo do nome do vídeo: o site, o idioma (só português e inglês têm nome) e a data.
     *
     * @param trailer Trailer.
     * @return Por exemplo "YouTube · em inglês · 13/11/2023".
     */
    fun meta(trailer: MovieTrailer): String = listOfNotNull(
        "YouTube",
        languageLabel(trailer.lang),
        trailer.published?.let(Formatting::fullDate)
    ).joinToString(" · ")

    /**
     * O que o leitor de tela diz do bloco inteiro, que abre o vídeo.
     *
     * @param trailer Trailer.
     * @return Por exemplo "Ver o trailer no YouTube: 4K Remastered Official Trailer (abre fora do app)".
     */
    fun accessibilityLabel(trailer: MovieTrailer): String {
        val name = trailer.name.ifBlank { "trailer do filme" }
        return "Ver o trailer no YouTube: $name (abre fora do app)"
    }

    private fun languageLabel(lang: String?): String? = when (lang) {
        "pt" -> "em português"
        "en" -> "em inglês"
        else -> null
    }
}
