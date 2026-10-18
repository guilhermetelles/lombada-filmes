package io.github.guilhermetelles.lombada.data.model

import java.time.Instant

/**
 * Uma alternativa da pergunta.
 *
 * @property id `a`, `b`, `c` ou `d`.
 * @property label Texto.
 * @property imageUrl Imagem, quando a pergunta usa.
 */
data class QuizOption(val id: String, val label: String, val imageUrl: String?)

/**
 * Recorte do pôster na pergunta de pôster; o app recorta.
 *
 * @property x Centro horizontal, de 0 a 1.
 * @property y Centro vertical, de 0 a 1.
 * @property zoom Ampliação.
 */
data class PosterCrop(val x: Double, val y: Double, val zoom: Double)

/**
 * Mídia da pergunta; cada tipo usa só a sua.
 *
 * @property posterPath Pôster do TMDb.
 * @property crop Recorte do pôster.
 * @property excerpt Trecho verbatim de um comentário, com o título trocado por ▇▇▇.
 * @property emoji Enredo em emojis.
 * @property synopsis Sinopse sem nomes.
 */
data class QuizMedia(
    val posterPath: String?,
    val crop: PosterCrop?,
    val excerpt: String?,
    val emoji: String?,
    val synopsis: String?
)

/**
 * Pergunta em `lists/{listId}/quizzes/{id}`, sem a resposta (que fica em `quizKeys`). O id é o dia
 * na pergunta diária e `inicio-NN` nas do evento de início (que valem em qualquer dia).
 *
 * @property id Id do documento: o dia `AAAA-MM-DD`, ou `inicio-01` … `inicio-10`.
 * @property day Dia `AAAA-MM-DD`, no fuso de Brasília (no evento, o dia em que foi criada).
 * @property type Tipo: `diretor`, `ano`, `trecho`, `poster`, `ranking`, `mes`, `personagem`, `emoji`,
 *   `sinopse`, `bechdel`, `bilheteria` ou `premio`.
 * @property prompt Enunciado.
 * @property options Alternativas.
 * @property media Mídia, quando o tipo usa.
 * @property createdAt Quando foi gerada.
 * @property event Evento a que pertence (`inicio`), ou null na pergunta do dia.
 * @property eventIndex Número no evento, de 1 a 10; null na pergunta do dia.
 */
data class QuizDoc(
    val id: String,
    val day: String,
    val type: String,
    val prompt: String,
    val options: List<QuizOption>,
    val media: QuizMedia?,
    val createdAt: Instant?,
    val event: String? = null,
    val eventIndex: Int? = null
)

/**
 * Resposta de um membro em `quizzes/{id}/answers/{uid}`. Só é legível depois de responder.
 *
 * @property uid Quem respondeu.
 * @property optionId Alternativa escolhida.
 * @property correct Se acertou.
 * @property answeredAt Quando respondeu.
 */
data class QuizAnswer(val uid: String, val optionId: String, val correct: Boolean, val answeredAt: Instant?)
