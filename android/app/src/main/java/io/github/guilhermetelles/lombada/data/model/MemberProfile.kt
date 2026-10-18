package io.github.guilhermetelles.lombada.data.model

/**
 * Nome e foto de um membro, em `lists/{listId}.memberProfiles.{uid}`, sincronizados pelo backend a
 * partir da conta Google.
 *
 * @property name Nome.
 * @property photoUrl Foto, se houver.
 */
data class MemberProfile(val name: String, val photoUrl: String?)
