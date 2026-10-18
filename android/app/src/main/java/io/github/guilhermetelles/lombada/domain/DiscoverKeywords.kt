package io.github.guilhermetelles.lombada.domain

/**
 * Palavra-chave do TMDb ligada na busca avançada, vinda do texto livre.
 *
 * @property id Id da palavra-chave no TMDb.
 * @property label Rótulo em português.
 */
data class Keyword(val id: Int, val label: String)

/** Palavras-chave da busca avançada: junção, parâmetro `kw` e a linha "Tem:" dos resultados. */
object DiscoverKeywords {
    /** Máximo de palavras-chave ligadas ao mesmo tempo (o `kw` aceita até 5). */
    const val MAX = 5

    /**
     * Junta as palavras novas às ligadas, sem repetir id. Uma palavra que volta passa a valer
     * como nova; acima de [MAX], saem as mais antigas. Palavras sem id válido ou sem rótulo ficam
     * de fora.
     *
     * @param current Palavras ligadas, da mais antiga para a mais nova.
     * @param added Palavras novas, na ordem recebida.
     * @return As palavras ligadas depois da junção.
     */
    fun merge(current: List<Keyword>, added: List<Keyword>): List<Keyword> {
        val fresh =
            added
                .map { it.copy(label = it.label.trim()) }
                .filter { it.id > 0 && it.label.isNotEmpty() }
                .distinctBy { it.id }
        val freshIds = fresh.map { it.id }.toSet()
        return (current.filter { it.id !in freshIds } + fresh).takeLast(MAX)
    }

    /**
     * Valor do parâmetro `kw` do `discover`.
     *
     * @param keywords Palavras ligadas.
     * @return Os ids separados por vírgula, ou null sem palavras.
     */
    fun param(keywords: List<Keyword>): String? =
        keywords.takeIf { it.isNotEmpty() }?.joinToString(",") { it.id.toString() }

    /**
     * Linha discreta de um resultado com as palavras que ele tem, na ordem das ligadas.
     *
     * @param keywords Palavras ligadas.
     * @param matched Ids que o filme tem (`matchedKeywords`).
     * @return "Tem: tubarão, ilha", ou null quando nenhuma ligada casou.
     */
    fun matchedLine(keywords: List<Keyword>, matched: List<Int>): String? {
        if (matched.isEmpty()) return null
        val ids = matched.toSet()
        val labels = keywords.filter { it.id in ids }.map { it.label }
        return labels.takeIf { it.isNotEmpty() }?.joinToString(", ", prefix = "Tem: ")
    }
}
