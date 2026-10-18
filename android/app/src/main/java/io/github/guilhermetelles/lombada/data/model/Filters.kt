package io.github.guilhermetelles.lombada.data.model

import kotlinx.serialization.Serializable

/**
 * Filtros da busca avançada, vindos da tela ou de `POST /api/search/interpret`. Valores como texto
 * para tolerar valores novos do backend.
 *
 * @property mood Humores: `leve`, `tenso`, `ruim-divertido`, `chorar`, `cult`.
 * @property dur Durações: `ate90`, `90a120`, `mais120`.
 * @property dec Décadas: `antes70`, `1970`, `1980`, `1990`, `2000`, `2010`, `2020`.
 * @property genre Gêneros.
 * @property theme Temas: `lgbt`, `fatos`, `trash`, `tempo`, `golpes`, `espaco`, `zumbis-vampiros`,
 *   `halloween`, `serial-killer`, `livro`.
 * @property svc Serviços de streaming.
 * @property fit Só filmes com a cara da lista.
 */
@Serializable
data class Filters(
    val mood: List<String> = emptyList(),
    val dur: List<String> = emptyList(),
    val dec: List<String> = emptyList(),
    val genre: List<String> = emptyList(),
    val theme: List<String> = emptyList(),
    val svc: List<String> = emptyList(),
    val fit: Boolean = false
)
