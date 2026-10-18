package io.github.guilhermetelles.lombada.ui.quiz

import android.content.Context
import androidx.core.content.edit
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * O que o backend devolve ao responder e que o app não consegue ler depois: a alternativa certa e a
 * explicação ficam em `quizKeys`, que ninguém lê.
 *
 * @property rightOptionId Alternativa certa.
 * @property explanation Explicação, pode ser vazia.
 */
@Serializable
data class QuizResult(val rightOptionId: String, val explanation: String)

/**
 * Guarda no aparelho o resultado de cada resposta, para a pergunta reaberta (ou o histórico)
 * mostrar a certa e a explicação. A segunda tentativa recebe 409 sem esses dados.
 *
 * @param context Contexto do app.
 */
class QuizResultCache(context: Context) {
    private val prefs = context.getSharedPreferences("quiz-results", Context.MODE_PRIVATE)

    /**
     * Lê o resultado guardado.
     *
     * @param listId Lista.
     * @param day Dia `AAAA-MM-DD`.
     * @return O resultado, ou null se a resposta não foi dada neste aparelho.
     */
    fun read(listId: String, day: String): QuizResult? =
        prefs.getString(key(listId, day), null)?.let { runCatching { json.decodeFromString<QuizResult>(it) }.getOrNull() }

    /**
     * Guarda o resultado de uma resposta.
     *
     * @param listId Lista.
     * @param day Dia `AAAA-MM-DD`.
     * @param result Certa e explicação.
     */
    fun save(listId: String, day: String, result: QuizResult) {
        prefs.edit { putString(key(listId, day), json.encodeToString(result)) }
    }

    private fun key(listId: String, day: String) = "$listId/$day"

    private companion object {
        val json = Json { ignoreUnknownKeys = true }
    }
}
