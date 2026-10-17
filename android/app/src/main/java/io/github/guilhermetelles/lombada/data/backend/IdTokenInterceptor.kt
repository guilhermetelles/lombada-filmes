package io.github.guilhermetelles.lombada.data.backend

import com.google.android.gms.tasks.Tasks
import com.google.firebase.auth.FirebaseAuth
import java.io.IOException
import java.util.concurrent.ExecutionException
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Põe `Authorization: Bearer <ID token>` em toda chamada. Roda na thread do OkHttp, então espera
 * o token de forma bloqueante; o SDK só vai à rede quando o token venceu.
 *
 * @param auth Instância do Firebase Auth.
 */
class IdTokenInterceptor(private val auth: FirebaseAuth) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val user = auth.currentUser ?: return chain.proceed(chain.request())
        val token =
            try {
                Tasks.await(user.getIdToken(false)).token
            } catch (error: ExecutionException) {
                // Renovar o token precisa de rede: a falha vira erro de rede, como a do próprio pedido.
                throw IOException("Não deu para renovar o login.", error)
            }
        val request = chain.request().newBuilder().header("Authorization", "Bearer $token").build()
        return chain.proceed(request)
    }
}
