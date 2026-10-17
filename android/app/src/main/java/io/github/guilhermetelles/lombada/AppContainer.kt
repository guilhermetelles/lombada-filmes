package io.github.guilhermetelles.lombada

import android.content.Context
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.firestoreSettings
import com.google.firebase.firestore.persistentCacheSettings
import io.github.guilhermetelles.lombada.data.auth.AuthRepository
import io.github.guilhermetelles.lombada.data.backend.BackendClient
import io.github.guilhermetelles.lombada.data.backend.IdTokenInterceptor
import io.github.guilhermetelles.lombada.data.firestore.ListRepository
import io.github.guilhermetelles.lombada.data.firestore.UserRepository

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
}
