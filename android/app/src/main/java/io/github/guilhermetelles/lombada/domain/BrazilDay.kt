package io.github.guilhermetelles.lombada.domain

import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId

/**
 * "Hoje" e "este mês" no fuso de Brasília, como o backend (`lib/time/brazil-day.ts`): o quiz, o
 * placar e as retrospectivas usam esses ids, qualquer que seja o fuso do celular.
 */
object BrazilDay {
    /** Fuso de Brasília. */
    val ZONE: ZoneId = ZoneId.of("America/Sao_Paulo")

    /**
     * Dia em Brasília de um instante.
     *
     * @param instant Instante.
     * @return O dia.
     */
    fun of(instant: Instant): LocalDate = instant.atZone(ZONE).toLocalDate()

    /**
     * Dia de hoje em Brasília.
     *
     * @param clock Relógio, trocado nos testes.
     * @return O dia.
     */
    fun today(clock: Clock = Clock.systemUTC()): LocalDate = of(clock.instant())

    /**
     * Id do dia de hoje, como nos documentos `quizzes/{dia}`.
     *
     * @param clock Relógio, trocado nos testes.
     * @return `AAAA-MM-DD`.
     */
    fun todayId(clock: Clock = Clock.systemUTC()): String = today(clock).toString()

    /**
     * Id do mês atual, como nos documentos `scores/{mês}` e `retros/{mês}`.
     *
     * @param clock Relógio, trocado nos testes.
     * @return `AAAA-MM`.
     */
    fun monthId(clock: Clock = Clock.systemUTC()): String = YearMonth.from(today(clock)).toString()
}
