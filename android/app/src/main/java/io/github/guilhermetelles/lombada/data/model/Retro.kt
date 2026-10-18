package io.github.guilhermetelles.lombada.data.model

import java.time.Instant

/**
 * Retrospectiva de um mês, em `lists/{listId}/retros/{mês}`.
 *
 * @property month Mês `AAAA-MM`.
 * @property films Filmes vistos no mês.
 * @property minutes Minutos somados.
 * @property bestEntryId Entrada mais bem colocada do mês.
 * @property worstEntryId Entrada mais mal colocada do mês.
 * @property genres Gêneros e quantidades, do mais visto para o menos.
 * @property text Parágrafo gerado a partir dos comentários do mês, quando houver.
 * @property generatedAt Quando foi gerada.
 */
data class Retro(
    val month: String,
    val films: Int,
    val minutes: Int,
    val bestEntryId: String?,
    val worstEntryId: String?,
    val genres: List<Pair<String, Int>>,
    val text: String?,
    val generatedAt: Instant?
)
