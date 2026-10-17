package io.github.guilhermetelles.lombada.domain

/**
 * Ordem das listas visitadas, guardada em `users/{uid}.recentListIds` como texto com ids separados
 * por vírgula, da mais recente para a mais antiga (as regras não conferem itens de uma lista).
 */
object RecentLists {
    /** Máximo de ids que as regras aceitam. */
    const val MAX = 200

    /**
     * Lê o texto guardado.
     *
     * @param stored Valor de `recentListIds`.
     * @return Ids na ordem guardada, sem vazios.
     */
    fun parse(stored: String?): List<String> = stored.orEmpty().split(',').filter { it.isNotBlank() }

    /**
     * Põe uma lista na frente, tirando a repetição e cortando no máximo das regras.
     *
     * @param ids Ordem atual.
     * @param listId Lista visitada agora.
     * @return Nova ordem.
     */
    fun visit(ids: List<String>, listId: String): List<String> =
        (listOf(listId) + ids.filter { it != listId }).take(MAX)

    /**
     * Tira uma lista da ordem, ao sair ou apagar.
     *
     * @param ids Ordem atual.
     * @param listId Lista a tirar.
     * @return Nova ordem.
     */
    fun forget(ids: List<String>, listId: String): List<String> = ids.filter { it != listId }

    /**
     * Escreve no formato guardado.
     *
     * @param ids Ordem das listas.
     * @return Texto com os ids separados por vírgula.
     */
    fun serialize(ids: List<String>): String = ids.joinToString(",")
}
