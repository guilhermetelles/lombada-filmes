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
 * @property errors Erros, de todos os tipos.
 * @property quota Respostas 429 (sem cota), quando o backend sabe.
 * @property answered Respostas; null em backend antigo, que não mandava.
 * @property unavailable Erros de modelo fora do ar (5xx ou 404).
 * @property timeout Pedidos sem resposta no tempo limite ou com falha de rede.
 * @property format Respostas fora do formato pedido.
 * @property latencyMs Soma do tempo das respostas, em milissegundos.
 */
@Serializable
data class GeminiModelUsage(
    val calls: Int = 0,
    val errors: Int = 0,
    val quota: Int? = null,
    val answered: Int? = null,
    val unavailable: Int = 0,
    val timeout: Int = 0,
    val format: Int = 0,
    val latencyMs: Long = 0
)

/**
 * Pedidos de um uso do Gemini (busca, sugestões, quiz, retrospectiva) num dia.
 *
 * @property requests Pedidos.
 * @property answered Respondidos por algum modelo.
 * @property failed Falharam depois de tentar os modelos.
 */
@Serializable
data class GeminiPurposeUsage(val requests: Int = 0, val answered: Int = 0, val failed: Int = 0)

/**
 * Modelo do Gemini que o backend está pulando agora.
 *
 * @property model Nome do modelo.
 * @property until Até quando, em ISO 8601.
 * @property reason `quota` (sem cota) ou `unavailable` (fora do ar).
 */
@Serializable
data class GeminiResting(val model: String, val until: String, val reason: String = "quota")

/**
 * Consumo de um dia, em `GET /api/status`.
 *
 * @property day Dia `AAAA-MM-DD` em Brasília.
 * @property sources Pedidos e erros por fonte.
 * @property geminiModels Consumo por modelo do Gemini.
 * @property geminiPurposes Pedidos por uso do Gemini (`search`, `recs`, `quiz`, `retro`).
 */
@Serializable
data class StatusUsageDay(
    val day: String,
    val sources: Map<String, CallCount> = emptyMap(),
    val geminiModels: Map<String, GeminiModelUsage> = emptyMap(),
    val geminiPurposes: Map<String, GeminiPurposeUsage> = emptyMap()
)

/**
 * Ordem dos modelos do Gemini que o backend tenta: quando a cota de um acaba, passa ao seguinte.
 *
 * @property interpret Modelos da busca em texto livre, na ordem.
 * @property text Modelos dos textos (motivos, quiz, retrospectiva), na ordem.
 * @property resting Modelos pulados agora (sem cota ou fora do ar), do que volta antes para o que volta depois.
 * @property dailyLimitNote Explicação do limite diário escrita pelo backend.
 */
@Serializable
data class GeminiInfo(
    val interpret: List<String> = emptyList(),
    val text: List<String> = emptyList(),
    val resting: List<GeminiResting> = emptyList(),
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
