package io.github.guilhermetelles.lombada.data.model

import java.time.Instant
import kotlinx.serialization.Serializable

/**
 * Argumentos de uma [RouteRef]; cada rota usa só os seus.
 *
 * @property tmdbId Filme.
 * @property personId Pessoa.
 * @property day Dia `AAAA-MM-DD`.
 * @property month Mês `AAAA-MM`.
 * @property entryId Entrada.
 * @property entryIdB Segunda entrada (duelo).
 */
@Serializable
data class RouteArgs(
    val tmdbId: Int? = null,
    val personId: Int? = null,
    val day: String? = null,
    val month: String? = null,
    val entryId: String? = null,
    val entryIdB: String? = null
)

/**
 * Tela que um item do feed ou um push abre. Chega no Firestore e, em JSON, nos extras do push.
 *
 * @property name `movie`, `person`, `quiz`, `quizPlay`, `queue`, `recs`, `feed`, `listInfo`, `retro`,
 *   `duel`, `memory` ou `reports`.
 * @property args Argumentos da tela.
 */
@Serializable
data class RouteRef(val name: String, val args: RouteArgs = RouteArgs())

/**
 * Item da Atividade, em `lists/{listId}/feed/{feedId}`. Só o backend escreve.
 *
 * @property id Id do documento.
 * @property type Tipo do evento, como `member.activity`, `queue.added` ou `daily.quiz`.
 * @property kind Canal: `lista`, `quiz`, `curiosidade` ou `lembrete`.
 * @property createdAt Quando aconteceu.
 * @property actorUid Membro que fez, quando houver.
 * @property title Texto principal, pronto.
 * @property body Texto de apoio, quando houver.
 * @property quote Comentário citado verbatim, quando houver.
 * @property route Tela que o toque abre.
 */
data class FeedItem(
    val id: String,
    val type: String,
    val kind: String,
    val createdAt: Instant?,
    val actorUid: String?,
    val title: String,
    val body: String?,
    val quote: String?,
    val route: RouteRef?
)
