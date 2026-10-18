package io.github.guilhermetelles.lombada.domain

/**
 * Evento de início de uso do app: 10 perguntas extras em `quizzes/inicio-01` … `inicio-10`, que
 * valem em qualquer dia. Lógica pura para a aba Quiz e a tela da pergunta.
 */
object QuizEvent {
    /** Valor do campo `event` nas perguntas do evento. */
    const val NAME = "inicio"

    /** Quantas perguntas o evento tem. */
    const val SIZE = 10

    /** Nome do evento como aparece no app. */
    const val TITLE = "Início de uso do app"

    private val ID_PATTERN = Regex("^$NAME-(\\d{2})$")

    /**
     * Se o id do documento é de uma pergunta do evento (e não um dia `AAAA-MM-DD`).
     *
     * @param id Id do documento em `quizzes`.
     * @return true para `inicio-01` … `inicio-10`.
     */
    fun isEventId(id: String): Boolean = indexOf(id) != null

    /**
     * Número da pergunta a partir do id.
     *
     * @param id Id do documento, como `inicio-03`.
     * @return De 1 a [SIZE], ou null se não é do evento.
     */
    fun indexOf(id: String): Int? =
        ID_PATTERN.matchEntire(id)?.groupValues?.get(1)?.toIntOrNull()?.takeIf { it in 1..SIZE }

    /**
     * Id do documento da pergunta de um número.
     *
     * @param index De 1 a [SIZE].
     * @return Por exemplo `inicio-03`.
     */
    fun idOf(index: Int): String = "$NAME-${index.toString().padStart(2, '0')}"

    /**
     * Próxima pergunta não respondida, na ordem do evento.
     *
     * @param ids Ids das perguntas que existem, em qualquer ordem.
     * @param answered Ids já respondidos pela pessoa.
     * @param after Se dado, procura primeiro depois deste id e só então volta ao começo.
     * @return O id, ou null quando todas estão respondidas.
     */
    fun nextUnanswered(ids: Collection<String>, answered: Set<String>, after: String? = null): String? {
        val pending = ids.filter { it !in answered && it != after }.sortedBy { indexOf(it) ?: Int.MAX_VALUE }
        val from = after?.let { indexOf(it) } ?: return pending.firstOrNull()
        return pending.firstOrNull { (indexOf(it) ?: 0) > from } ?: pending.firstOrNull()
    }

    /**
     * Progresso da pessoa no evento.
     *
     * @param ids Ids das perguntas que existem.
     * @param results Resultado de cada pergunta respondida: id e se acertou.
     * @return Respondidas, acertos e total.
     */
    fun progress(ids: Collection<String>, results: Map<String, Boolean>): QuizEventProgress {
        val known = ids.toSet()
        val answered = results.filterKeys { it in known }
        return QuizEventProgress(
            answered = answered.size,
            correct = answered.values.count { it },
            total = maxOf(known.size, SIZE)
        )
    }
}

/**
 * Progresso no evento.
 *
 * @property answered Quantas a pessoa respondeu.
 * @property correct Quantas acertou.
 * @property total Quantas o evento tem (10).
 */
data class QuizEventProgress(val answered: Int, val correct: Int, val total: Int) {
    /** Se respondeu todas. */
    val done: Boolean get() = answered >= total
}
