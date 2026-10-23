package io.github.guilhermetelles.lombada.domain

/**
 * Ordem dos resultados da busca avançada, no parâmetro `sort` de `GET /api/discover`. Nas duas, os
 * filmes com mais palavras-chave da frase vêm primeiro.
 *
 * @property apiParam Valor do parâmetro.
 * @property label Nome no seletor.
 * @property summary Como a contagem dos resultados descreve a ordem.
 */
enum class DiscoverSort(val apiParam: String, val label: String, val summary: String) {
    /** Mistura a posição no TMDb (filtros e popularidade) com a compatibilidade. O padrão. */
    Relevance("relevance", "Relevância", "pela relevância"),

    /** Só a compatibilidade com o gosto de vocês. */
    Compat("compat", "Compatibilidade", "pela compatibilidade")
}
