package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.FeedItem
import java.time.Instant
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

/**
 * Filtros da Atividade.
 *
 * @property label Rótulo do chip.
 * @property kind `kind` do feed que o filtro mostra; null mostra tudo.
 */
enum class FeedFilter(val label: String, val kind: String?) {
    /** Todos os itens. */
    All("Tudo", null),

    /** O que os membros fizeram na lista. */
    List("Lista", "lista"),

    /** Quiz e placar. */
    Quiz("Quiz", "quiz"),

    /** Curiosidades sobre os filmes. */
    Curio("Curiosidades", "curiosidade"),

    /** Lembretes do dia. */
    Reminder("Lembretes", "lembrete")
}

/**
 * Itens de um mesmo grupo de dias.
 *
 * @property label "Hoje", "Ontem", "Esta semana" ou "Antes".
 * @property items Itens, do mais novo para o mais antigo.
 */
data class FeedGroup(val label: String, val items: List<FeedItem>)

/** Agrupamento e horários da Atividade, sempre no dia de Brasília. */
object FeedGroups {
    private val hourMinute = DateTimeFormatter.ofPattern("HH:mm")
    private val dayMonth = DateTimeFormatter.ofPattern("dd/MM")

    /**
     * Filtra e agrupa os itens por dia: Hoje, Ontem, Esta semana (até 6 dias) e Antes.
     *
     * @param items Itens, do mais novo para o mais antigo.
     * @param filter Filtro escolhido.
     * @param today Dia de hoje em Brasília.
     * @return Os grupos que têm itens, na ordem.
     */
    fun group(items: List<FeedItem>, filter: FeedFilter, today: LocalDate): List<FeedGroup> {
        val shown = items.filter { filter.kind == null || it.kind == filter.kind }
        return shown
            .groupBy { groupLabel(it.createdAt, today) }
            .entries
            .sortedBy { GROUPS.indexOf(it.key) }
            .map { (label, list) -> FeedGroup(label, list) }
    }

    /**
     * Grupo de um instante.
     *
     * @param at Quando aconteceu; null (ainda sem horário do servidor) conta como agora.
     * @param today Dia de hoje em Brasília.
     * @return O rótulo do grupo.
     */
    fun groupLabel(at: Instant?, today: LocalDate): String {
        val days = at?.let { ChronoUnit.DAYS.between(BrazilDay.of(it), today) } ?: 0
        return when {
            days <= 0 -> GROUPS[0]
            days == 1L -> GROUPS[1]
            days <= 6 -> GROUPS[2]
            else -> GROUPS[3]
        }
    }

    /**
     * Horário ao lado do item: hora e minuto em hoje e ontem, senão dia e mês.
     *
     * @param at Quando aconteceu.
     * @param today Dia de hoje em Brasília.
     * @return Por exemplo "21:32" ou "03/10"; vazio sem horário.
     */
    fun timeLabel(at: Instant?, today: LocalDate): String {
        if (at == null) return ""
        val local = at.atZone(BrazilDay.ZONE)
        val days = ChronoUnit.DAYS.between(local.toLocalDate(), today)
        return if (days <= 1) local.format(hourMinute) else local.format(dayMonth)
    }

    private val GROUPS = listOf("Hoje", "Ontem", "Esta semana", "Antes")
}
