package io.github.guilhermetelles.lombada.ui.main

import kotlinx.serialization.Serializable

/** Lista ativa, a tela inicial. */
@Serializable
object ListRoute

/** Relatórios, a quinta aba. */
@Serializable
object ReportsRoute

/** "Vocês contra a crítica" completa. */
@Serializable
object CriticsRoute

/** Sobre o app: conta, atribuição do TMDb e licenças. */
@Serializable
object AboutRoute

/** Consumo das APIs. */
@Serializable
object UsageRoute

/** Fila "Quero ver", a segunda aba. */
@Serializable
object QueueRoute

/** Sugestões, a terceira aba. */
@Serializable
object RecsRoute

/** Quiz: a pergunta de hoje, o placar e o histórico; a quarta aba. */
@Serializable
object QuizRoute

/**
 * Pergunta do quiz.
 *
 * @property day Dia `AAAA-MM-DD` em Brasília; null é hoje.
 * @property type Tipo da pergunta, quando já se sabe antes de ler o documento.
 */
@Serializable
data class QuizPlayRoute(val day: String? = null, val type: String? = null)

/** Atividade da lista (o sino). */
@Serializable
object FeedRoute

/** Detalhes da lista: membros, placar, vencedores e convite. */
@Serializable
object ListInfoRoute

/**
 * Comentário do dia.
 *
 * @property entryId Entrada; null deixa a tela escolher a de hoje.
 */
@Serializable
data class MemoryRoute(val entryId: String? = null)

/**
 * Retrospectiva de um mês.
 *
 * @property month Mês `AAAA-MM`.
 */
@Serializable
data class RetroRoute(val month: String)

/**
 * Duelo entre duas entradas.
 *
 * @property entryIdA Primeira entrada; null deixa a tela sortear.
 * @property entryIdB Segunda entrada; null deixa a tela sortear.
 */
@Serializable
data class DuelRoute(val entryIdA: String? = null, val entryIdB: String? = null)

/** Busca avançada, com filtros e texto livre. */
@Serializable
object AdvancedSearchRoute

/** Sorteio de um filme da fila. */
@Serializable
object RouletteRoute

/** Configurações de notificação. */
@Serializable
object NotifySettingsRoute

/**
 * Detalhe de um filme, da lista ou de fora dela. Título, ano e capa vêm junto para a tela abrir na
 * hora, antes do Firestore.
 *
 * @property tmdbId Filme.
 * @property title Título conhecido.
 * @property year Ano conhecido.
 * @property posterPath Capa conhecida.
 */
@Serializable
data class MovieRoute(val tmdbId: Int, val title: String, val year: Int? = null, val posterPath: String? = null)

/**
 * Tela de um diretor ou ator.
 *
 * @property personId Pessoa no TMDb.
 * @property name Nome conhecido.
 * @property profilePath Foto conhecida.
 * @property department `directing` abre como diretor; `acting`, como ator.
 */
@Serializable
data class PersonRoute(
    val personId: Int,
    val name: String,
    val profilePath: String? = null,
    val department: String = "acting"
)
