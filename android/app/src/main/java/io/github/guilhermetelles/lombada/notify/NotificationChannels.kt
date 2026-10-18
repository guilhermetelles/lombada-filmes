package io.github.guilhermetelles.lombada.notify

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context

/**
 * Canais de notificação, um por `kind` do feed (contrato §4). O backend manda o id do canal em
 * `android.notification.channel_id`; o nome é o que aparece nas configurações do Android.
 */
object NotificationChannels {
    /** Atividade da outra pessoa na lista e na fila. */
    const val LIST = "lista"

    /** Quiz do dia e resultados. */
    const val QUIZ = "quiz"

    /** Curiosidades sobre os filmes e as pessoas da lista. */
    const val CURIO = "curiosidade"

    /** Lembretes: comentário do dia, retrospectiva, duelo, estreias e o resto da notificação diária. */
    const val REMINDER = "lembrete"

    private class Channel(val id: String, val name: String, val description: String, val importance: Int)

    private val ALL =
        listOf(
            Channel(
                LIST,
                "Lista",
                "Quando a outra pessoa adiciona, move ou comenta um filme, ou pede um na fila",
                NotificationManager.IMPORTANCE_DEFAULT
            ),
            Channel(
                QUIZ,
                "Quiz",
                "A pergunta do dia, o resultado e o vencedor do mês",
                NotificationManager.IMPORTANCE_DEFAULT
            ),
            Channel(
                CURIO,
                "Curiosidades",
                "Fatos sobre os filmes e as pessoas da lista",
                NotificationManager.IMPORTANCE_DEFAULT
            ),
            Channel(
                REMINDER,
                "Lembretes",
                "Comentário do dia, retrospectiva, duelo, estreias e aniversários",
                NotificationManager.IMPORTANCE_DEFAULT
            )
        )

    /**
     * Escolhe o canal de um aviso.
     *
     * @param kind `kind` vindo do push; desconhecido ou ausente cai em [REMINDER].
     * @return Id de um canal criado por [ensure].
     */
    fun forKind(kind: String?): String = ALL.firstOrNull { it.id == kind }?.id ?: REMINDER

    /**
     * Cria os canais, ou atualiza nome e descrição; chamar antes de qualquer aviso. Repetir não muda
     * o que a pessoa escolheu para cada canal.
     *
     * @param context Contexto.
     */
    fun ensure(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        manager.createNotificationChannels(
            ALL.map { channel ->
                NotificationChannel(channel.id, channel.name, channel.importance).apply {
                    description = channel.description
                }
            }
        )
    }
}
