package io.github.guilhermetelles.lombada.data.model

import kotlinx.serialization.Serializable

/**
 * Última execução de uma rotina do backend, em `GET /api/status`.
 *
 * @property name Nome técnico, como `enrich` ou `notify-09`.
 * @property lastRunAt Quando rodou, em ISO 8601; null se nunca rodou.
 * @property durationMs Duração em milissegundos.
 * @property status `ok`, `partial` ou `failed`.
 * @property summary Resumo do que fez.
 * @property warnings Avisos da execução.
 */
@Serializable
data class JobStatus(
    val name: String,
    val lastRunAt: String? = null,
    val durationMs: Long? = null,
    val status: String = "",
    val summary: String? = null,
    val warnings: List<String> = emptyList()
)

/**
 * Pedidos e erros de uma fonte num dia.
 *
 * @property calls Pedidos.
 * @property errors Erros.
 */
@Serializable
data class CallCount(val calls: Int = 0, val errors: Int = 0)

/**
 * Consumo de um modelo do Gemini num dia.
 *
 * @property calls Pedidos.
 * @property errors Erros.
 * @property quota Cota diária do modelo, quando o backend sabe.
 */
@Serializable
data class GeminiModelUsage(val calls: Int = 0, val errors: Int = 0, val quota: Int? = null)

/**
 * Consumo de um dia, em `GET /api/status`.
 *
 * @property day Dia `AAAA-MM-DD` em Brasília.
 * @property sources Pedidos e erros por fonte.
 * @property geminiModels Consumo por modelo do Gemini.
 */
@Serializable
data class StatusUsageDay(
    val day: String,
    val sources: Map<String, CallCount> = emptyMap(),
    val geminiModels: Map<String, GeminiModelUsage> = emptyMap()
)

/**
 * Ordem dos modelos do Gemini que o backend tenta: quando a cota de um acaba, passa ao seguinte.
 *
 * @property interpret Modelos da busca em texto livre, na ordem.
 * @property text Modelos dos textos (motivos, quiz, retrospectiva), na ordem.
 * @property dailyLimitNote Explicação do limite diário escrita pelo backend.
 */
@Serializable
data class GeminiInfo(
    val interpret: List<String> = emptyList(),
    val text: List<String> = emptyList(),
    val dailyLimitNote: String? = null
)

/**
 * Resposta de `GET /api/status`.
 *
 * @property jobs Rotinas, com a última execução de cada.
 * @property usage Consumo dos últimos 7 dias.
 * @property gemini Modelos do Gemini; null se o backend não mandou.
 */
@Serializable
data class AppStatus(
    val jobs: List<JobStatus> = emptyList(),
    val usage: List<StatusUsageDay> = emptyList(),
    val gemini: GeminiInfo? = null
)
