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
 * Pergunta do dia em `lists/{listId}/quizzes/{dia}`, sem a resposta (que fica em `quizKeys`).
 *
 * @property day Dia `AAAA-MM-DD`, no fuso de Brasília.
 * @property type Tipo: `diretor`, `ano`, `trecho`, `poster`, `ranking`, `mes`, `personagem`, `emoji`,
 *   `sinopse`, `bechdel`, `bilheteria` ou `premio`.
 * @property prompt Enunciado.
 * @property options Alternativas.
 * @property media Mídia, quando o tipo usa.
 * @property createdAt Quando foi gerada.
 */
data class QuizDoc(
    val day: String,
    val type: String,
    val prompt: String,
    val options: List<QuizOption>,
    val media: QuizMedia?,
    val createdAt: Instant?
)

/**
 * Resposta de um membro em `quizzes/{dia}/answers/{uid}`. Só é legível depois de responder.
 *
 * @property uid Quem respondeu.
 * @property optionId Alternativa escolhida.
 * @property correct Se acertou.
 * @property answeredAt Quando respondeu.
 */
data class QuizAnswer(val uid: String, val optionId: String, val correct: Boolean, val answeredAt: Instant?)
