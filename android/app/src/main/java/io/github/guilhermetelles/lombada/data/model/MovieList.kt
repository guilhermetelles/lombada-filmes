package io.github.guilhermetelles.lombada.data.model

/**
 * Lista compartilhada em `lists/{listId}`.
 *
 * @property id Id do documento.
 * @property name Nome, de 1 a 80 caracteres.
 * @property description Descrição, até 280 caracteres.
 * @property ownerUid Quem pode apagar a lista.
 * @property memberUids Quem lê e edita.
 * @property memberProfiles Nome e foto de cada membro, por uid; vazio até o backend sincronizar.
 */
data class MovieList(
    val id: String,
    val name: String,
    val description: String,
    val ownerUid: String,
    val memberUids: List<String>,
    val memberProfiles: Map<String, MemberProfile> = emptyMap()
)
