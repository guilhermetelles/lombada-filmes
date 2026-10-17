package io.github.guilhermetelles.lombada.data

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.google.firebase.firestore.Source
import io.github.guilhermetelles.lombada.data.firestore.UserRepository
import io.github.guilhermetelles.lombada.support.Emulators
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/** `users/{uid}` como o app grava, contra as regras do emulador. */
@RunWith(AndroidJUnit4::class)
class UserRepositoryTest {
    private val users = UserRepository(Emulators.firestore)

    @Before
    fun clear() = runBlocking { Emulators.clearFirestore() }

    @Test
    fun primeiroLoginCriaOPerfilDentroDasRegras() = runBlocking {
        val uid = Emulators.signIn("perfil@teste.lombada")
        val profile = users.ensure(requireNotNull(Emulators.auth.currentUser))
        assertEquals("perfil", profile.displayName)
        val stored = Emulators.firestore.collection("users").document(uid).get(Source.SERVER).await()
        assertEquals("", stored.getString("recentListIds"))
        assertEquals(null, stored.getString("activeListId"))
    }

    @Test
    fun visitarPoeAListaNaFrenteEAtiva() = runBlocking {
        val uid = Emulators.signIn("visita@teste.lombada")
        users.ensure(requireNotNull(Emulators.auth.currentUser))
        users.visit(uid, "L1")
        users.visit(uid, "L2")
        users.visit(uid, "L1")
        val stored = Emulators.firestore.collection("users").document(uid).get(Source.SERVER).await()
        assertEquals("L1,L2", stored.getString("recentListIds"))
        assertEquals("L1", stored.getString("activeListId"))
        users.forget(uid, "L1")
        val after = Emulators.firestore.collection("users").document(uid).get(Source.SERVER).await()
        assertEquals("L2", after.getString("recentListIds"))
        assertEquals("L2", after.getString("activeListId"))
    }
}
