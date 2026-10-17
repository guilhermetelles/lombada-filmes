package io.github.guilhermetelles.lombada.data

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.Source
import io.github.guilhermetelles.lombada.data.firestore.EntryRepository
import io.github.guilhermetelles.lombada.data.firestore.ListRepository
import io.github.guilhermetelles.lombada.data.model.MovieSnapshot
import io.github.guilhermetelles.lombada.data.model.PersonRef
import io.github.guilhermetelles.lombada.domain.FractionalIndex
import io.github.guilhermetelles.lombada.support.Emulators
import java.time.LocalDate
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/** Gravações da lista como o app faz (sem esperar o servidor), conferidas contra as regras. */
@RunWith(AndroidJUnit4::class)
class EntryRepositoryTest {
    private val errors = mutableListOf<Exception>()
    private val entries = EntryRepository(Emulators.firestore) { errors += it }
    private val lists = ListRepository(Emulators.firestore)
    private val abyss =
        MovieSnapshot(
            "The Abyss",
            1989,
            "/kRP5dGXDhKt7bDpXX4YBa4dRwlL.jpg",
            7.5,
            3.72,
            listOf(PersonRef(2710, "James Cameron"))
        )

    @Before
    fun clear() = runBlocking {
        Emulators.clearFirestore()
        errors.clear()
    }

    private suspend fun synced() = Emulators.firestore.waitForPendingWrites().await()

    @Test
    fun criarMoverEditarERemoverPassamPelasRegras() = runBlocking {
        val uid = Emulators.signIn("lista@teste.lombada")
        Emulators.seedList("L1", uid, listOf(uid))
        val first = FractionalIndex.keyBetween(null, null)
        val id = entries.create("L1", 2756, first, LocalDate.parse("2025-10-12"), "Muito bom", abyss, uid)
        synced()
        assertTrue("recusas: $errors", errors.isEmpty())

        val moved = FractionalIndex.keyBetween(first, null)
        entries.move("L1", id, moved, uid)
        entries.edit("L1", id, null, "Comentário novo", uid)
        synced()
        assertTrue("recusas: $errors", errors.isEmpty())
        val stored =
            Emulators.firestore
                .collection("lists")
                .document("L1")
                .collection("entries")
                .document(id)
                .get(Source.SERVER)
                .await()
        assertEquals(moved, stored.getString("rankKey"))
        assertEquals(null, stored.getString("watchedOn"))
        assertEquals("Comentário novo", stored.getString("comment"))
        assertEquals(listOf("The Abyss"), entries.observeRanking("L1").first().map { it.movie.title })

        entries.remove("L1", id)
        synced()
        assertTrue("recusas: $errors", errors.isEmpty())
        assertTrue(entries.observeRanking("L1").first().isEmpty())
    }

    @Test
    fun quemNaoEMembroNaoGrava() = runBlocking {
        val owner = Emulators.signIn("dona@teste.lombada")
        Emulators.seedList("L2", owner, listOf(owner))
        val stranger = Emulators.signIn("estranha@teste.lombada")
        entries.create("L2", 2756, "a0", null, "", abyss, stranger)
        synced()
        val denied = errors.single() as FirebaseFirestoreException
        assertEquals(FirebaseFirestoreException.Code.PERMISSION_DENIED, denied.code)
    }

    @Test
    fun membroEditaNomeEDescricaoEVeAsListas() = runBlocking {
        val uid = Emulators.signIn("nome@teste.lombada")
        Emulators.seedList("L3", uid, listOf(uid))
        lists.updateDetails("L3", "Novo nome", "Descrição nova")
        val mine = lists.observeMine(uid).first()
        assertEquals(listOf("Novo nome"), mine.map { it.name })
        assertEquals("Descrição nova", mine.single().description)
        assertFalse(lists.fetchMine(uid).isEmpty())
    }
}
