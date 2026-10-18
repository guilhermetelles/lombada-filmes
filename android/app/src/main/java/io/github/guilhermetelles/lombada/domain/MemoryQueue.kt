package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Entry
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import kotlin.math.abs

/**
 * Um comentário que pode voltar como "comentário do dia".
 *
 * @property entry Entrada com o comentário.
 * @property daysAgo Dias desde que viram o filme.
 */
data class MemoryPick(val entry: Entry, val daysAgo: Long)

/**
 * Fila do comentário do dia, como no mock (`memoryQueue`): primeiro os aniversários do dia em que
 * viram (até 10 dias de distância de 1, 2… anos), do mais perto para o mais longe; depois os mais
 * antigos, com um desvio fixo por dia, para o mesmo comentário valer o dia todo.
 */
object MemoryQueue {
    /** Só voltam comentários de filmes vistos há pelo menos tantos dias. */
    const val MIN_DAYS = 30L

    private const val ANNIVERSARY_WINDOW = 10.0
    private const val DAYS_PER_YEAR = 365.25
    private const val DAYS_PER_MONTH = 30.44
    private const val JITTER_DAYS = 120L
    private const val UINT_MASK = 0xFFFFFFFFL

    /**
     * Distância, em dias, até o aniversário mais próximo do dia em que viram.
     *
     * @param days Dias desde que viram.
     * @return A distância, ou infinito antes de completar (perto de) 1 ano.
     */
    fun anniversaryGap(days: Long): Double {
        val years = Math.round(days / DAYS_PER_YEAR)
        return if (years >= 1) abs(days - years * DAYS_PER_YEAR) else Double.POSITIVE_INFINITY
    }

    /**
     * Ordena os comentários que podem voltar hoje.
     *
     * @param entries Entradas da lista.
     * @param today Dia de hoje em Brasília.
     * @return A fila do dia; vazia quando nenhum comentário tem 30 dias ou mais.
     */
    fun queue(entries: List<Entry>, today: LocalDate): List<MemoryPick> {
        val seed = today.toString().fold(7L) { acc, char -> (acc * 31 + char.code) and UINT_MASK }
        return entries
            .mapNotNull { entry ->
                val watched = entry.watchedOn ?: return@mapNotNull null
                if (entry.comment.isBlank() || watched.isAfter(today)) return@mapNotNull null
                val days = ChronoUnit.DAYS.between(watched, today)
                if (days < MIN_DAYS) null else MemoryPick(entry, days)
            }.sortedWith(
                Comparator<MemoryPick> { a, b ->
                    val gapA = anniversaryGap(a.daysAgo)
                    val gapB = anniversaryGap(b.daysAgo)
                    val annA = gapA <= ANNIVERSARY_WINDOW
                    val annB = gapB <= ANNIVERSARY_WINDOW
                    when {
                        annA != annB -> if (annA) -1 else 1
                        annA -> gapA.compareTo(gapB)
                        else -> (b.daysAgo + jitter(b.entry.id, seed)).compareTo(a.daysAgo + jitter(a.entry.id, seed))
                    }
                }.thenBy { it.entry.id }
            )
    }

    /**
     * Há quanto tempo viram, como no mock: anos perto do aniversário, senão meses, semanas ou dias.
     *
     * @param days Dias desde que viram.
     * @return Por exemplo "Há 2 anos", "Há 5 meses" ou "Há 3 semanas".
     */
    fun agoLabel(days: Long): String {
        val years = Math.round(days / DAYS_PER_YEAR)
        return when {
            anniversaryGap(days) <= ANNIVERSARY_WINDOW -> if (years == 1L) "Há 1 ano" else "Há $years anos"
            days >= 60 -> "Há ${Math.round(days / DAYS_PER_MONTH)} meses"
            days >= 14 -> "Há ${Math.round(days / 7.0)} semanas"
            else -> "Há $days dias"
        }
    }

    // Desvio de 0 a 119 dias, fixo para a entrada no dia: mistura os mais antigos sem mudar ao longo do dia.
    private fun jitter(entryId: String, seed: Long): Long {
        val id = entryId.hashCode().toLong() and UINT_MASK
        return ((id * 2654435761L + seed) and UINT_MASK) % JITTER_DAYS
    }
}
