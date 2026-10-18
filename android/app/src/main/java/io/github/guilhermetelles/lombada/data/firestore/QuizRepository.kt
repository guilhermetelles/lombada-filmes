package io.github.guilhermetelles.lombada.data.firestore

import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.snapshots
import io.github.guilhermetelles.lombada.data.model.PosterCrop
import io.github.guilhermetelles.lombada.data.model.QuizAnswer
import io.github.guilhermetelles.lombada.data.model.QuizDoc
import io.github.guilhermetelles.lombada.data.model.QuizMedia
import io.github.guilhermetelles.lombada.data.model.QuizOption
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Quiz diário em `lists/{listId}/quizzes/{dia}`, as perguntas do evento de início em
 * `quizzes/inicio-NN` e as respostas em `answers/{uid}`. Só o backend
 * escreve; responder passa por `BackendClient.answerQuiz`.
 *
 * @param db Instância do Firestore.
 */
class QuizRepository(private val db: FirebaseFirestore) {
    private fun quizzes(listId: String) = db.collection("lists").document(listId).collection("quizzes")

    /**
     * Acompanha a pergunta de um dia.
     *
     * @param listId Lista.
     * @param day Id do documento: o dia `AAAA-MM-DD` em Brasília (`BrazilDay.todayId()` para hoje) ou
     *   `inicio-NN` no evento.
     * @return Fluxo com a pergunta, ou null enquanto a rotina não gerou.
     */
    fun observeQuiz(listId: String, day: String): Flow<QuizDoc?> =
        quizzes(listId).document(day).snapshots().map { it.toQuiz() }.endOnPermissionDenied()

    /**
     * Acompanha as perguntas mais recentes, para o histórico.
     *
     * As do evento também têm `day` e entram na contagem; quem mostra o histórico as tira.
     *
     * @param listId Lista.
     * @param limit Quantas, no máximo.
     * @return Fluxo com as perguntas, da mais nova para a mais antiga.
     */
    fun observeRecent(listId: String, limit: Long = 30): Flow<List<QuizDoc>> = quizzes(listId)
        .orderBy("day", Query.Direction.DESCENDING)
        .limit(limit)
        .snapshots()
        .map { snapshot -> snapshot.documents.mapNotNull { it.toQuiz() } }
        .endOnPermissionDenied()

    /**
     * Acompanha as perguntas de um evento (como as 10 do início de uso do app).
     *
     * @param listId Lista.
     * @param event Valor do campo `event`, como `inicio`.
     * @return Fluxo com as perguntas, na ordem do evento; vazio enquanto o backend não gravou.
     */
    fun observeEvent(listId: String, event: String): Flow<List<QuizDoc>> = quizzes(listId)
        .whereEqualTo("event", event)
        .snapshots()
        .map { snapshot ->
            snapshot.documents.mapNotNull { it.toQuiz() }.sortedBy { it.eventIndex ?: Int.MAX_VALUE }
        }.endOnPermissionDenied()

    /**
     * Acompanha a própria resposta do dia. As regras sempre deixam ler a própria.
     *
     * @param listId Lista.
     * @param day Id do documento: o dia ou `inicio-NN`.
     * @param uid Pessoa logada.
     * @return Fluxo com a resposta, ou null antes de responder.
     */
    fun observeMyAnswer(listId: String, day: String, uid: String): Flow<QuizAnswer?> = quizzes(listId)
        .document(day)
        .collection("answers")
        .document(uid)
        .snapshots()
        .map { it.toAnswer() }
        .endOnPermissionDenied()

    /**
     * Acompanha as respostas de todos os membros. Só chamar depois que a pessoa respondeu: antes,
     * as regras negam e o fluxo termina vazio.
     *
     * @param listId Lista.
     * @param day Id do documento: o dia ou `inicio-NN`.
     * @return Fluxo com as respostas.
     */
    fun observeAnswers(listId: String, day: String): Flow<List<QuizAnswer>> = quizzes(listId)
        .document(day)
        .collection("answers")
        .snapshots()
        .map { snapshot -> snapshot.documents.mapNotNull { it.toAnswer() } }
        .endOnPermissionDenied()

    private fun DocumentSnapshot.toQuiz(): QuizDoc? {
        if (!exists()) return null
        val media = get("media") as? Map<*, *>
        return QuizDoc(
            id = id,
            day = getString("day") ?: id,
            type = getString("type") ?: return null,
            prompt = getString("prompt") ?: return null,
            options =
                (get("options") as? List<*>).orEmpty().filterIsInstance<Map<*, *>>().mapNotNull { item ->
                    QuizOption(
                        id = item.string("id") ?: return@mapNotNull null,
                        label = item.string("label") ?: return@mapNotNull null,
                        imageUrl = item.string("imageUrl")
                    )
                },
            media =
                media?.let { raw ->
                    QuizMedia(
                        posterPath = raw.string("posterPath"),
                        crop =
                            (raw["crop"] as? Map<*, *>)?.let { crop ->
                                PosterCrop(
                                    x = crop.double("x") ?: return@let null,
                                    y = crop.double("y") ?: return@let null,
                                    zoom = crop.double("zoom") ?: return@let null
                                )
                            },
                        excerpt = raw.string("excerpt"),
                        emoji = raw.string("emoji"),
                        synopsis = raw.string("synopsis")
                    )
                },
            createdAt = getTimestamp("createdAt")?.toDate()?.toInstant(),
            event = getString("event"),
            eventIndex = getLong("eventIndex")?.toInt()
        )
    }

    private fun DocumentSnapshot.toAnswer(): QuizAnswer? {
        if (!exists()) return null
        return QuizAnswer(
            uid = id,
            optionId = getString("optionId") ?: return null,
            correct = getBoolean("correct") ?: false,
            answeredAt = getTimestamp("answeredAt")?.toDate()?.toInstant()
        )
    }
}
