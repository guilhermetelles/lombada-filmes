package io.github.guilhermetelles.lombada.data.model

import kotlinx.serialization.Serializable

/**
 * Tipos da notificação diária que a pessoa quer receber.
 *
 * @property quiz Quiz do dia.
 * @property curio Curiosidade.
 * @property memory Comentário do dia.
 * @property retro Retrospectiva do mês.
 * @property release Estreia de alguém da lista.
 * @property streaming Filme da fila que chegou no streaming.
 * @property duel Duelo.
 * @property milestone Marco da lista.
 * @property birthday Aniversário de diretor ou ator.
 */
@Serializable
data class NotifyTypes(
    val quiz: Boolean = true,
    val curio: Boolean = true,
    val memory: Boolean = true,
    val retro: Boolean = true,
    val release: Boolean = true,
    val streaming: Boolean = true,
    val duel: Boolean = true,
    val milestone: Boolean = true,
    val birthday: Boolean = true
)

/**
 * Preferências de notificação, guardadas pelo backend (`GET` e `PUT /api/me/notify`). Os valores
 * padrão são os do contrato.
 *
 * @property freq A cada quantos dias vem a diária: 0 (nunca), 1, 3 ou 7.
 * @property hour Hora em Brasília: 9, 12, 19 ou 21.
 * @property types Tipos da diária.
 * @property activity Avisar quando o outro membro mexe na lista.
 * @property activityGrouped Juntar os avisos de atividade num só.
 */
@Serializable
data class NotifyPrefs(
    val freq: Int = 3,
    val hour: Int = 19,
    val types: NotifyTypes = NotifyTypes(),
    val activity: Boolean = true,
    val activityGrouped: Boolean = true
)
