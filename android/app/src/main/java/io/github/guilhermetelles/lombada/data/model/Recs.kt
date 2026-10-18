package io.github.guilhermetelles.lombada.data.model

import java.time.Instant

/**
 * Uma sugestão em `recs/current`.
 *
 * @property tmdbId Filme.
 * @property title Título.
 * @property year Ano.
 * @property posterPath Capa.
 * @property runtime Duração em minutos.
 * @property genres Gêneros em português.
 * @property providers Streaming por assinatura no Brasil.
 * @property score Compatibilidade, de 0 a 100.
 * @property reason Frase curta com o motivo.
 * @property reasonFrom Ids das entradas ou filmes da lista que justificam.
 * @property reasonBy Quem escreveu o motivo: `gemini` ou `rules`; null nos documentos antigos.
 * @property source `model`, `trending` ou `nowPlaying`.
 * @property kind `saga`, `diretor`, `tema` ou `emAlta`.
 */
data class RecItem(
    val tmdbId: Int,
    val title: String,
    val year: Int?,
    val posterPath: String?,
    val runtime: Int?,
    val genres: List<String>,
    val providers: List<String>,
    val score: Int,
    val reason: String,
    val reasonFrom: List<String>,
    val source: String,
    val kind: String,
    val reasonBy: String? = null
)

/**
 * Modelo de gosto da lista: regressão logística com até 300 variáveis.
 *
 * @property bias Termo independente.
 * @property weights Peso de cada variável.
 */
data class TasteModel(val bias: Double, val weights: Map<String, Double>)

/**
 * Documento `lists/{listId}/recs/current`, escrito pela rotina `recs`.
 *
 * @property computedAt Quando foi calculado.
 * @property modelVersion Versão do modelo.
 * @property model Pesos do modelo.
 * @property items Até 30 sugestões, da maior compatibilidade para a menor.
 * @property trending Até 15 filmes em alta ou em cartaz no Brasil, fora da lista.
 */
data class RecsDoc(
    val computedAt: Instant?,
    val modelVersion: String,
    val model: TasteModel?,
    val items: List<RecItem>,
    val trending: List<RecItem>
)
