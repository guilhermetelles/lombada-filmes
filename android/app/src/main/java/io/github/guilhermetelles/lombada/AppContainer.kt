package io.github.guilhermetelles.lombada

import android.content.Context
import androidx.compose.material3.SnackbarHostState
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.firestoreSettings
import com.google.firebase.firestore.persistentCacheSettings
import io.github.guilhermetelles.lombada.data.auth.AuthRepository
import io.github.guilhermetelles.lombada.data.backend.BackendClient
import io.github.guilhermetelles.lombada.data.backend.IdTokenInterceptor
import io.github.guilhermetelles.lombada.data.firestore.DismissedRepository
import io.github.guilhermetelles.lombada.data.firestore.EntryRepository
import io.github.guilhermetelles.lombada.data.firestore.FeedRepository
import io.github.guilhermetelles.lombada.data.firestore.ListRepository
import io.github.guilhermetelles.lombada.data.firestore.MovieRepository
import io.github.guilhermetelles.lombada.data.firestore.PersonRepository
import io.github.guilhermetelles.lombada.data.firestore.QueueRepository
import io.github.guilhermetelles.lombada.data.firestore.QuizRepository
import io.github.guilhermetelles.lombada.data.firestore.RecsRepository
import io.github.guilhermetelles.lombada.data.firestore.RetroRepository
import io.github.guilhermetelles.lombada.data.firestore.ScoresRepository
import io.github.guilhermetelles.lombada.data.firestore.UsageRepository
import io.github.guilhermetelles.lombada.data.firestore.UserRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Dependências do app, montadas à mão uma vez por processo.
 *
 * @param context Contexto do app.
 */
class AppContainer(context: Context) {
    private val auth = FirebaseAuth.getInstance()

    private val db =
        FirebaseFirestore.getInstance().apply {
            // Cache offline em disco: a lista abre e edita sem internet e sincroniza ao voltar.
            firestoreSettings = firestoreSettings { setLocalCacheSettings(persistentCacheSettings {}) }
        }

    /** Login e sessão. */
    val authRepository = AuthRepository(auth, context.getString(R.string.default_web_client_id))

    /** Rotas do backend. */
    val backend = BackendClient.create(BuildConfig.BACKEND_URL, IdTokenInterceptor(auth))

    /** Perfil da pessoa. */
    val users = UserRepository(db)

    /** Listas. */
    val lists = ListRepository(db)

    /** Catálogo de filmes. */
    val movies = MovieRepository(db)

    /** Fichas de diretores e atores. */
    val people = PersonRepository(db)

    /** Consumo das APIs. */
    val usage = UsageRepository(db)

    /** Escopo que sobrevive às telas, para gravações adiadas como a remoção com "Desfazer". */
    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    /** Snackbar comum a todas as telas. */
    val snackbar = SnackbarHostState()

    // Gravações recusadas pelas regras viram aviso no snackbar.
    private val onWriteError: (Exception) -> Unit = { error ->
        appScope.launch { snackbar.showSnackbar(writeFailureMessage(error)) }
    }

    /** Entradas das listas. */
    val entries = EntryRepository(db, onWriteError)

    /** Fila "Quero ver" (só leitura; gravar passa pelo backend). */
    val queue = QueueRepository(db)

    /** Sugestões calculadas pela rotina `recs`. */
    val recs = RecsRepository(db)

    /** Sugestões recusadas ("Não quero"). */
    val dismissed = DismissedRepository(db, onWriteError)

    /** Atividade da lista. */
    val feed = FeedRepository(db)

    /** Quiz diário e respostas. */
    val quiz = QuizRepository(db)

    /** Placar mensal do quiz. */
    val scores = ScoresRepository(db)

    /** Retrospectivas mensais. */
    val retros = RetroRepository(db)

    private fun writeFailureMessage(error: Exception): String =
        if (error is FirebaseFirestoreException && error.code == FirebaseFirestoreException.Code.PERMISSION_DENIED) {
            "O banco recusou a alteração. Ela foi desfeita."
        } else {
            "Não deu para salvar a alteração."
        }
}
