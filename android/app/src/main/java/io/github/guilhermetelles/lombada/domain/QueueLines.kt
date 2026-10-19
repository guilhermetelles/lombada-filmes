package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.MemberProfile
import io.github.guilhermetelles.lombada.data.model.QueueItem
import java.time.LocalDate

/** Textos de um item da fila "Quero ver". */
object QueueLines {
    /**
     * Itens da fila que ainda não estão na lista, do mais recente para o mais antigo (os que o
     * servidor ainda não confirmou vêm primeiro).
     *
     * @param queue Itens da fila.
     * @param inList Filmes que já são entradas.
     * @return A fila visível.
     */
    fun visible(queue: List<QueueItem>, inList: Set<Int>): List<QueueItem> = queue
        .filter { it.tmdbId !in inList }
        .sortedWith(compareByDescending<QueueItem> { it.createdAt == null }.thenByDescending { it.createdAt })

    /**
     * Quem pediu e quando.
     *
     * @param item Item da fila.
     * @param uid Pessoa logada.
     * @param profiles Nome e foto dos membros.
     * @param today Hoje, no fuso de Brasília.
     * @return "Você pediu · hoje" ou "Ana pediu · 12/10/26".
     */
    fun requester(item: QueueItem, uid: String, profiles: Map<String, MemberProfile>, today: LocalDate): String {
        val who =
            when (item.addedBy) {
                uid -> "Você pediu"
                else -> "${profiles[item.addedBy]?.name?.trim()?.takeIf { it.isNotEmpty() } ?: "Alguém da lista"} pediu"
            }
        val day = item.createdAt?.let(BrazilDay::of) ?: return who
        return "$who · ${if (day == today) "hoje" else Formatting.shortDate(day)}"
    }

    /**
     * Onde assistir no Brasil.
     *
     * @param providers Serviços por assinatura, ou null quando o backend ainda não buscou.
     * @return "Onde assistir: A, B e C", "Em nenhum streaming por assinatura agora" ou null sem dados.
     */
    fun where(providers: List<String>?): String? = when {
        providers == null -> null
        providers.isEmpty() -> "Em nenhum streaming por assinatura agora"
        else -> "Onde assistir: ${PortugueseText.join(StreamingServices.unify(providers).take(4))}"
    }
}
