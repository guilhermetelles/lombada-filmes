package io.github.guilhermetelles.lombada.data.model

import java.time.Instant

/**
 * Filme na fila "Quero ver", em `lists/{listId}/queue/{tmdbId}`. Só o backend escreve; título e
 * capa vêm de `movies/{tmdbId}`.
 *
 * @property tmdbId Filme.
 * @property addedBy Quem pôs na fila.
 * @property createdAt Quando entrou; null enquanto o servidor não confirmou.
 */
data class QueueItem(val tmdbId: Int, val addedBy: String, val createdAt: Instant?)
