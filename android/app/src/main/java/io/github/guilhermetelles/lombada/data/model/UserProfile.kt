package io.github.guilhermetelles.lombada.data.model

/**
 * Perfil em `users/{uid}`.
 *
 * @property displayName Nome mostrado, de 1 a 80 caracteres.
 * @property photoUrl Foto da conta Google, se houver.
 * @property recentListIds Listas visitadas, da mais recente para a mais antiga.
 * @property activeListId Lista que abre ao iniciar.
 */
data class UserProfile(
    val displayName: String,
    val photoUrl: String?,
    val recentListIds: List<String>,
    val activeListId: String?
)
