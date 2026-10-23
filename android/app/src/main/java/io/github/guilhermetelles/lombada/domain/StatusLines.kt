package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.GeminiInfo
import io.github.guilhermetelles.lombada.data.model.SourceUsage
import io.github.guilhermetelles.lombada.data.model.StatusUsageDay
import io.github.guilhermetelles.lombada.data.model.UsageDay
import java.time.Instant
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/** Como terminou a última execução de uma rotina. */
enum class JobHealth(val label: String) {
    /** Tudo certo. */
    Ok("Tudo certo"),

    /** Terminou, mas parte ficou para depois ou deu erro. */
    Partial("Em parte"),

    /** Falhou. */
    Failed("Falhou"),

    /** O backend mandou um valor que o app não conhece. */
    Unknown("Sem informação");

    companion object {
        /**
         * Lê o valor da API.
         *
         * @param wire `ok`, `partial` ou `failed`.
         * @return O estado; [Unknown] para outro valor.
         */
        fun fromWire(wire: String?): JobHealth = when (wire) {
            "ok" -> Ok
            "partial" -> Partial
            "failed" -> Failed
            else -> Unknown
        }
    }
}

/**
 * Uma linha da tabela de consumo por fonte.
 *
 * @property source Chave da fonte.
 * @property name Nome para a tela.
 * @property calls Pedidos de cada dia, na ordem de [UsageTable.days].
 * @property errors Erros de cada dia, na mesma ordem.
 */
data class UsageTableRow(val source: String, val name: String, val calls: List<Int>, val errors: List<Int>) {
    /** Pedidos na semana. */
    val totalCalls: Int get() = calls.sum()

    /** Erros na semana. */
    val totalErrors: Int get() = errors.sum()
}

/**
 * Consumo por fonte e por dia.
 *
 * @property days Dias, do mais recente (hoje, à esquerda) para o mais antigo.
 * @property rows Uma linha por fonte com algum pedido no período, na ordem fixa das fontes.
 */
data class UsageTable(val days: List<LocalDate>, val rows: List<UsageTableRow>)

/**
 * Um modelo do Gemini e o consumo de hoje.
 *
 * @property model Nome do modelo.
 * @property calls Pedidos hoje.
 * @property errors Erros hoje.
 * @property quota Respostas 429 de hoje (modelo sem cota), quando o backend sabe.
 * @property answered Respostas hoje; null quando o backend não mandou.
 * @property unavailable Erros de modelo fora do ar (5xx ou 404).
 * @property timeout Pedidos sem resposta no tempo ou com falha de rede.
 * @property format Respostas fora do formato pedido.
 * @property latencyMs Soma do tempo das respostas.
 */
data class GeminiModelLine(
    val model: String,
    val calls: Int,
    val errors: Int,
    val quota: Int?,
    val answered: Int? = null,
    val unavailable: Int = 0,
    val timeout: Int = 0,
    val format: Int = 0,
    val latencyMs: Long = 0
)

/**
 * Um uso do Gemini e o resultado dos pedidos de hoje.
 *
 * @property label Nome do uso para a tela.
 * @property requests Pedidos.
 * @property answered Respondidos.
 * @property failed Falharam depois de tentar os modelos.
 */
data class GeminiPurposeLine(val label: String, val requests: Int, val answered: Int, val failed: Int)

/**
 * Modelo do Gemini pulado agora.
 *
 * @property model Nome do modelo.
 * @property label "sem cota até 04:00" ou "fora do ar até 15:23".
 */
data class GeminiRestingLine(val model: String, val label: String)

/** Textos e contas das telas de consumo e de status do app, sem Android. */
object StatusLines {
    private val hourFormat = DateTimeFormatter.ofPattern("HH:mm")
    private val dayFormat = DateTimeFormatter.ofPattern("dd/MM")

    /** Fontes na ordem das telas, com o nome. */
    val SOURCE_NAMES: List<Pair<String, String>> =
        listOf(
            "tmdb" to "TMDb",
            "letterboxd" to "Letterboxd",
            "omdb" to "OMDb",
            "bechdel" to "Bechdel Test",
            "wikidata" to "Wikidata",
            "wikipedia" to "Wikipedia",
            "gemini" to "Gemini"
        )

    /** Usos do Gemini, na ordem da tela, com o nome. */
    private val GEMINI_PURPOSES =
        linkedMapOf(
            "search" to "Busca em texto livre",
            "recs" to "Sugestões",
            "quiz" to "Quiz",
            "retro" to "Retrospectiva"
        )

    private val jobNames =
        mapOf(
            "enrich" to "Dados extras dos filmes",
            "recs" to "Sugestões",
            "quiz-and-month" to "Quiz do dia e fechamento do mês",
            "daily" to "Assunto do dia e limpeza da Atividade",
            "notify-09" to "Avisos das 9h",
            "notify-12" to "Avisos das 12h",
            "notify-19" to "Avisos das 19h",
            "notify-21" to "Avisos das 21h",
            "ratings" to "Notas dos filmes"
        )

    /**
     * Nome da rotina em português.
     *
     * @param name Nome técnico, com ou sem `cron/` e extensão.
     * @return O nome para a tela; o técnico quando o app não conhece.
     */
    fun jobName(name: String): String {
        val key = name.substringAfterLast('/').removeSuffix(".ts").removePrefix("_")
        return jobNames[key] ?: key
    }

    /**
     * Quando a rotina rodou, no fuso de Brasília.
     *
     * @param lastRunAt Instante em ISO 8601, ou null.
     * @param now Agora.
     * @return "hoje às 05:56", "ontem às 05:56", "em 12/10 às 05:56" ou "ainda não rodou".
     */
    fun lastRunLabel(lastRunAt: String?, now: Instant): String {
        val instant = lastRunAt?.let { runCatching { Instant.parse(it) }.getOrNull() } ?: return "ainda não rodou"
        val at = instant.atZone(BrazilDay.ZONE)
        val today = BrazilDay.of(now)
        val hour = at.format(hourFormat)
        return when (at.toLocalDate()) {
            today -> "hoje às $hour"
            today.minusDays(1) -> "ontem às $hour"
            else -> "em ${at.format(dayFormat)} às $hour"
        }
    }

    /**
     * Duração legível.
     *
     * @param durationMs Milissegundos, ou null.
     * @return "0,8 s", "42 s" ou "3 min 5 s"; null sem duração.
     */
    fun durationLabel(durationMs: Long?): String? {
        val ms = durationMs?.takeIf { it >= 0 } ?: return null
        val seconds = ms / 1000
        return when {
            ms < 1000 -> "0,${(ms / 100).coerceAtLeast(1)} s"
            seconds < 60 -> "$seconds s"
            seconds % 60 == 0L -> "${seconds / 60} min"
            else -> "${seconds / 60} min ${seconds % 60} s"
        }
    }

    /**
     * Monta a tabela de consumo por fonte. Fontes desconhecidas entram no fim, pelo nome técnico.
     *
     * @param usage Dias de `GET /api/status`, em qualquer ordem.
     * @return A tabela; sem linhas quando nenhum dia tem pedidos.
     */
    fun usageTable(usage: List<StatusUsageDay>): UsageTable {
        val byDay =
            usage
                .mapNotNull { day -> runCatching { LocalDate.parse(day.day) }.getOrNull()?.let { it to day } }
                .sortedByDescending { it.first }
        val days = byDay.map { it.first }
        val known = SOURCE_NAMES.map { it.first }.toSet()
        val extra = byDay.flatMap { it.second.sources.keys }.filter { it !in known }.distinct().sorted()
        val rows =
            (SOURCE_NAMES + extra.map { it to it }).mapNotNull { (key, name) ->
                val calls = byDay.map { it.second.sources[key]?.calls ?: 0 }
                val errors = byDay.map { it.second.sources[key]?.errors ?: 0 }
                UsageTableRow(key, name, calls, errors).takeIf { it.totalCalls > 0 || it.totalErrors > 0 }
            }
        return UsageTable(days, rows)
    }

    /**
     * Modelos do Gemini na ordem em que o backend tenta, com o consumo de hoje. Modelos que só
     * aparecem no consumo entram no fim.
     *
     * @param gemini Ordem dos modelos, ou null.
     * @param usage Dias de `GET /api/status`.
     * @param today Hoje em Brasília.
     * @return Uma linha por modelo.
     */
    fun geminiToday(gemini: GeminiInfo?, usage: List<StatusUsageDay>, today: LocalDate): List<GeminiModelLine> {
        val todayUsage = usage.firstOrNull { it.day == today.toString() }?.geminiModels.orEmpty()
        val order = (gemini?.interpret.orEmpty() + gemini?.text.orEmpty() + todayUsage.keys.sorted()).distinct()
        return order.map { model ->
            val used = todayUsage[model]
            GeminiModelLine(
                model = model,
                calls = used?.calls ?: 0,
                errors = used?.errors ?: 0,
                quota = used?.quota,
                answered = used?.answered,
                unavailable = used?.unavailable ?: 0,
                timeout = used?.timeout ?: 0,
                format = used?.format ?: 0,
                latencyMs = used?.latencyMs ?: 0
            )
        }
    }

    /**
     * Resumo de um modelo: quantos pedidos ele respondeu.
     *
     * @param line Consumo do modelo hoje.
     * @return "3 de 7 respondidos", "1 pedido" (backend sem respostas) ou "nenhum pedido".
     */
    fun geminiModelSummary(line: GeminiModelLine): String {
        if (line.calls == 0) return "nenhum pedido"
        val answered = line.answered ?: return if (line.calls == 1) "1 pedido" else "${line.calls} pedidos"
        return if (line.calls == 1) "$answered de 1 respondido" else "$answered de ${line.calls} respondidos"
    }

    /**
     * Detalhe de um modelo: tempo médio das respostas e os erros por tipo.
     *
     * @param line Consumo do modelo hoje.
     * @return "média 1,8 s · 2 × fora do ar · 1 × sem resposta", ou vazio sem nada a dizer.
     */
    fun geminiModelDetail(line: GeminiModelLine): String {
        val answered = line.answered ?: 0
        val quota = line.quota ?: 0
        val other = (line.errors - quota - line.unavailable - line.timeout - line.format).coerceAtLeast(0)
        return listOfNotNull(
            if (answered > 0 && line.latencyMs > 0) "média ${secondsLabel(line.latencyMs / answered)}" else null,
            countLabel(quota, "sem cota"),
            countLabel(line.unavailable, "fora do ar"),
            countLabel(line.timeout, "sem resposta"),
            countLabel(line.format, "resposta inválida"),
            countLabel(other, "outro erro")
        ).joinToString(" · ")
    }

    /**
     * Usos do Gemini com pedidos hoje, na ordem fixa (busca, sugestões, quiz, retrospectiva) e os
     * desconhecidos no fim, pelo nome técnico.
     *
     * @param usage Dias de `GET /api/status`.
     * @param today Hoje em Brasília.
     * @return Uma linha por uso com pedidos.
     */
    fun geminiPurposesToday(usage: List<StatusUsageDay>, today: LocalDate): List<GeminiPurposeLine> {
        val todayUsage = usage.firstOrNull { it.day == today.toString() }?.geminiPurposes.orEmpty()
        val order = (GEMINI_PURPOSES.keys + todayUsage.keys.sorted()).distinct()
        return order.mapNotNull { key ->
            val used = todayUsage[key]?.takeIf { it.requests > 0 } ?: return@mapNotNull null
            GeminiPurposeLine(GEMINI_PURPOSES[key] ?: key, used.requests, used.answered, used.failed)
        }
    }

    /**
     * Resultado de um uso: quantos pedidos foram respondidos e quantos falharam.
     *
     * @param line Pedidos do uso hoje.
     * @return "8 de 10 respondidos · 2 falharam".
     */
    fun geminiPurposeLabel(line: GeminiPurposeLine): String {
        val answered =
            if (line.requests ==
                1
            ) {
                "${line.answered} de 1 respondido"
            } else {
                "${line.answered} de ${line.requests} respondidos"
            }
        val failed =
            when (line.failed) {
                0 -> null
                1 -> "1 falhou"
                else -> "${line.failed} falharam"
            }
        return listOfNotNull(answered, failed).joinToString(" · ")
    }

    /**
     * Modelos pulados agora, com o motivo e até quando, no fuso de Brasília.
     *
     * @param gemini Modelos do backend, ou null.
     * @param now Agora; prazos que já passaram ficam de fora.
     * @return "sem cota até 04:00", "fora do ar até amanhã às 04:00" ou "… até 21/10 às 04:00".
     */
    fun geminiResting(gemini: GeminiInfo?, now: Instant): List<GeminiRestingLine> =
        gemini?.resting.orEmpty().mapNotNull { resting ->
            val until = runCatching { Instant.parse(resting.until) }.getOrNull()?.takeIf { it > now }
            until ?: return@mapNotNull null
            val at = until.atZone(BrazilDay.ZONE)
            val today = BrazilDay.of(now)
            val hour = at.format(hourFormat)
            val day =
                when (at.toLocalDate()) {
                    today -> hour
                    today.plusDays(1) -> "amanhã às $hour"
                    else -> "${at.format(dayFormat)} às $hour"
                }
            val reason = if (resting.reason == "unavailable") "fora do ar" else "sem cota"
            GeminiRestingLine(resting.model, "$reason até $day")
        }

    private fun countLabel(count: Int, label: String): String? = if (count > 0) "$count × $label" else null

    private fun secondsLabel(ms: Long): String {
        val tenths = (ms + 50) / 100
        return "${tenths / 10},${tenths % 10} s"
    }

    /**
     * Completa os dias sem documento em `usage/` com zero, para as colunas não pularem dias.
     *
     * @param days Dias lidos, em qualquer ordem.
     * @param today Hoje em Brasília (o último dia).
     * @param count Quantos dias mostrar.
     * @return Exatamente [count] dias, do mais antigo para hoje.
     */
    fun fillDays(days: List<UsageDay>, today: LocalDate, count: Int): List<UsageDay> {
        val byDay = days.associateBy { it.day }
        return (count - 1 downTo 0).map { back ->
            val day = today.minusDays(back.toLong())
            byDay[day] ?: UsageDay(day, emptyMap())
        }
    }

    /**
     * Consumo de uma fonte num dia, zerado quando não houve pedido.
     *
     * @param day Dia, ou null.
     * @param source Chave da fonte.
     * @return O consumo.
     */
    fun sourceUsage(day: UsageDay?, source: String): SourceUsage =
        day?.sources?.get(source) ?: SourceUsage(0, 0, 0, null)
}
