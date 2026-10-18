package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.QuizAnswer
import java.time.Clock
import java.time.LocalTime

/**
 * Regras do quiz que o app precisa saber sem o backend: quando a pergunta sai, os nomes dos tipos e
 * qual é a alternativa certa a partir do que já se pode ler.
 */
object QuizRules {
    /** Horário em Brasília em que a rotina `quiz-and-month` gera a pergunta do dia. */
    val RELEASE_TIME: LocalTime = LocalTime.of(5, 30)

    private val TYPE_TITLES =
        mapOf(
            "diretor" to "Diretor",
            "ano" to "Ano",
            "trecho" to "Comentário",
            "poster" to "Pôster",
            "ranking" to "Ranking",
            "mes" to "Quando vimos",
            "personagem" to "Personagem",
            "emoji" to "Emojis",
            "sinopse" to "Sinopse",
            "bechdel" to "Bechdel",
            "bilheteria" to "Orçamento",
            "premio" to "Prêmios"
        )

    /**
     * Se ainda é cedo para a pergunta de hoje (antes das 05h30 em Brasília).
     *
     * @param clock Relógio, trocado nos testes.
     * @return true antes do horário.
     */
    fun beforeRelease(clock: Clock = Clock.systemUTC()): Boolean =
        clock.instant().atZone(BrazilDay.ZONE).toLocalTime().isBefore(RELEASE_TIME)

    /**
     * Nome do tipo da pergunta, como na aba Quiz do mock.
     *
     * @param type Tipo do contrato, como `trecho`.
     * @return Por exemplo "Comentário"; "Quiz" para um tipo desconhecido.
     */
    fun typeTitle(type: String): String = TYPE_TITLES[type] ?: "Quiz"

    /**
     * Alternativa certa sem ler `quizKeys` (que ninguém lê): a guardada ao responder neste aparelho,
     * senão a de quem acertou.
     *
     * @param remembered Certa devolvida pelo backend ao responder, se guardada.
     * @param answers Respostas legíveis do dia (a própria e as dos outros).
     * @return A alternativa certa, ou null quando ninguém acertou e não há resposta guardada.
     */
    fun rightOption(remembered: String?, answers: List<QuizAnswer>): String? =
        remembered ?: answers.firstOrNull { it.correct }?.optionId
}
