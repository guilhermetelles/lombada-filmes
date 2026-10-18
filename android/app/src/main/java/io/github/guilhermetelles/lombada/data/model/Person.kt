package io.github.guilhermetelles.lombada.data.model

import java.time.Instant
import java.time.LocalDate

/**
 * Filme da filmografia de uma pessoa.
 *
 * @property tmdbId Filme.
 * @property title Título em inglês.
 * @property year Ano.
 * @property character Personagem, na filmografia de ator.
 */
data class Credit(val tmdbId: Int, val title: String, val year: Int?, val character: String? = null)

/**
 * Ficha completa em `people/{id}`, escrita só pelo backend.
 *
 * @property id Pessoa no TMDb.
 * @property name Nome.
 * @property birthday Nascimento.
 * @property deathday Morte.
 * @property placeOfBirth Onde nasceu.
 * @property biography Biografia.
 * @property biographyInEnglish Se a biografia está em inglês (o TMDb não tinha em português).
 * @property profilePath Foto.
 * @property imdbId Id no IMDb.
 * @property directedCount Filmes dirigidos, segundo o TMDb.
 * @property directed Os mais populares dirigidos, até 12.
 * @property actedCount Filmes em que atuou, segundo o TMDb.
 * @property acted Os mais votados em que atuou, até 20.
 * @property fetchedAt Quando o backend buscou.
 * @property awards Prêmios e indicações; null enquanto a rotina não buscou.
 */
data class Person(
    val id: Int,
    val name: String,
    val birthday: LocalDate?,
    val deathday: LocalDate?,
    val placeOfBirth: String?,
    val biography: String?,
    val biographyInEnglish: Boolean,
    val profilePath: String?,
    val imdbId: String?,
    val directedCount: Int,
    val directed: List<Credit>,
    val actedCount: Int,
    val acted: List<Credit>,
    val fetchedAt: Instant?,
    val awards: Awards? = null
)
