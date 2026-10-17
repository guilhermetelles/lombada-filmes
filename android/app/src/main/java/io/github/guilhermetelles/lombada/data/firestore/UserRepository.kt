package io.github.guilhermetelles.lombada.data.firestore

import com.google.firebase.auth.FirebaseUser
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.snapshots
import io.github.guilhermetelles.lombada.data.model.UserProfile
import io.github.guilhermetelles.lombada.domain.RecentLists
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await

/**
 * Perfil `users/{uid}`, que só a própria pessoa lê e grava.
 *
 * @param db Instância do Firestore.
 */
class UserRepository(private val db: FirebaseFirestore) {
    private fun document(uid: String) = db.collection("users").document(uid)

    /**
     * Acompanha o perfil.
     *
     * @param uid Pessoa logada.
     * @return Fluxo com o perfil, ou null enquanto ele não existe.
     */
    fun observe(uid: String): Flow<UserProfile?> =
        document(uid).snapshots().map { it.toProfile() }.endOnPermissionDenied()

    /**
     * Cria o perfil no primeiro login, com os campos exatos que as regras pedem. Se já existe, não mexe.
     *
     * @param user Pessoa logada.
     * @return O perfil guardado ou o recém-criado.
     */
    suspend fun ensure(user: FirebaseUser): UserProfile {
        val existing = document(user.uid).get().await().toProfile()
        if (existing != null) return existing
        val profile =
            UserProfile(
                displayName = displayNameOf(user),
                photoUrl = user.photoUrl?.toString()?.takeIf { it.startsWith("https://") && it.length <= 500 },
                recentListIds = emptyList(),
                activeListId = null
            )
        document(user.uid)
            .set(
                mapOf(
                    "displayName" to profile.displayName,
                    "photoUrl" to profile.photoUrl,
                    "recentListIds" to "",
                    "activeListId" to null,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
        return profile
    }

    /**
     * Marca a lista como aberta: vira a ativa e vai para a frente das recentes. Lê o perfil na
     * hora, para não gravar por cima de uma visita feita em outra tela.
     *
     * @param uid Pessoa logada.
     * @param listId Lista aberta.
     */
    suspend fun visit(uid: String, listId: String) {
        val current = document(uid).get().await().toProfile() ?: return
        val recent = RecentLists.visit(current.recentListIds, listId)
        if (current.activeListId == listId && recent == current.recentListIds) return
        save(uid, recent, listId)
    }

    /**
     * Tira a lista do perfil, depois de sair ou apagar.
     *
     * @param uid Pessoa logada.
     * @param listId Lista que deixou de existir para a pessoa.
     */
    suspend fun forget(uid: String, listId: String) {
        val current = document(uid).get().await().toProfile() ?: return
        val recent = RecentLists.forget(current.recentListIds, listId)
        save(uid, recent, current.activeListId.takeIf { it != listId } ?: recent.firstOrNull())
    }

    private suspend fun save(uid: String, recent: List<String>, activeListId: String?) {
        document(uid)
            .update(
                mapOf(
                    "recentListIds" to RecentLists.serialize(recent),
                    "activeListId" to activeListId,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
    }

    private fun displayNameOf(user: FirebaseUser): String {
        val name = user.displayName?.trim().takeUnless { it.isNullOrEmpty() } ?: user.email?.substringBefore('@')
        return (name ?: "Pessoa").take(80)
    }

    private fun DocumentSnapshot.toProfile(): UserProfile? {
        if (!exists()) return null
        return UserProfile(
            displayName = getString("displayName").orEmpty(),
            photoUrl = getString("photoUrl"),
            recentListIds = RecentLists.parse(getString("recentListIds")),
            activeListId = getString("activeListId")
        )
    }
}
