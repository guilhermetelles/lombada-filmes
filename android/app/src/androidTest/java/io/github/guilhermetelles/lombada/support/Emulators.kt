package io.github.guilhermetelles.lombada.support

import androidx.test.platform.app.InstrumentationRegistry
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.firestoreSettings
import com.google.firebase.firestore.memoryCacheSettings
import java.time.Instant
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Firebase apontado para os emuladores de Auth e Firestore do `firebase/firebase.json`, com as
 * regras de verdade. No celular, `adb reverse tcp:8080 tcp:8080` e `adb reverse tcp:9099 tcp:9099`
 * levam 127.0.0.1 até a máquina que roda os emuladores.
 */
object Emulators {
    private const val HOST = "127.0.0.1"
    private const val FIRESTORE_PORT = 8080
    private const val AUTH_PORT = 9099

    /** Projeto de demonstração: o emulador não fala com nada de produção. */
    const val PROJECT = "demo-lombada"

    private val app: FirebaseApp by lazy {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        FirebaseApp.getApps(context).firstOrNull { it.name == "emulators" }
            ?: FirebaseApp.initializeApp(
                context,
                FirebaseOptions
                    .Builder()
                    .setProjectId(PROJECT)
                    .setApplicationId("1:1:android:1")
                    .setApiKey("emulator-api-key")
                    .build(),
                "emulators"
            )
    }

    /** Firestore do emulador, sem cache em disco. */
    val firestore: FirebaseFirestore by lazy {
        FirebaseFirestore.getInstance(app).apply {
            useEmulator(HOST, FIRESTORE_PORT)
            firestoreSettings = firestoreSettings { setLocalCacheSettings(memoryCacheSettings {}) }
        }
    }

    /** Auth do emulador. */
    val auth: FirebaseAuth by lazy { FirebaseAuth.getInstance(app).apply { useEmulator(HOST, AUTH_PORT) } }

    private val http = OkHttpClient()
    private val json = "application/json".toMediaType()

    /**
     * Entra com uma conta de e-mail no emulador de Auth, criando se ainda não existe.
     *
     * @param email E-mail da conta de teste.
     * @return Uid da conta.
     */
    suspend fun signIn(email: String): String {
        auth.signOut()
        val result =
            runCatching { auth.createUserWithEmailAndPassword(email, "senha-de-teste").await() }
                .getOrElse { auth.signInWithEmailAndPassword(email, "senha-de-teste").await() }
        return requireNotNull(result.user).uid
    }

    /** Apaga todos os documentos do emulador do Firestore. */
    suspend fun clearFirestore() {
        send(
            Request.Builder().url(
                "http://$HOST:$FIRESTORE_PORT/emulator/v1/projects/$PROJECT/databases/(default)/documents"
            ).delete().build()
        )
    }

    /**
     * Grava uma lista como o backend faria (o app não pode criar listas): acesso de administrador do
     * emulador, que ignora as regras.
     *
     * @param listId Id da lista.
     * @param ownerUid Dono.
     * @param members Membros.
     */
    suspend fun seedList(listId: String, ownerUid: String, members: List<String>) {
        val now = Instant.now().toString()
        val values = members.joinToString(",") { """{"stringValue":"$it"}""" }
        val body =
            """
            {"fields":{
              "name":{"stringValue":"Lista de teste"},
              "description":{"stringValue":""},
              "ownerUid":{"stringValue":"$ownerUid"},
              "memberUids":{"arrayValue":{"values":[$values]}},
              "createdAt":{"timestampValue":"$now"},
              "updatedAt":{"timestampValue":"$now"}
            }}
            """.trimIndent()
        send(
            Request
                .Builder()
                .url("http://$HOST:$FIRESTORE_PORT/v1/projects/$PROJECT/databases/(default)/documents/lists/$listId")
                .header("Authorization", "Bearer owner")
                .patch(body.toRequestBody(json))
                .build()
        )
    }

    private suspend fun send(request: Request) {
        withContext(Dispatchers.IO) {
            http.newCall(request).execute().use { response ->
                check(response.isSuccessful) { "emulador respondeu ${response.code}: ${response.body.string()}" }
            }
        }
    }
}
