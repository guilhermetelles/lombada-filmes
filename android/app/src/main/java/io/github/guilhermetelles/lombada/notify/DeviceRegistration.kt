package io.github.guilhermetelles.lombada.notify

import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import io.github.guilhermetelles.lombada.data.backend.BackendClient
import io.github.guilhermetelles.lombada.data.backend.BackendException
import kotlinx.coroutines.tasks.await

/**
 * Registro do token do FCM deste aparelho no backend (`POST`/`DELETE /api/me/devices`). O backend
 * guarda em `devices/{uid}/tokens`, que o app não lê nem grava.
 *
 * @param backend Cliente do backend.
 * @param messaging FCM do app.
 */
class DeviceRegistration(
    private val backend: BackendClient,
    private val messaging: FirebaseMessaging = FirebaseMessaging.getInstance()
) {
    /**
     * Registra o token atual para a pessoa logada, uma vez por processo e pessoa. Falha de rede fica
     * para a próxima abertura do app ou para o próximo [registerToken] do serviço.
     *
     * @param uid Pessoa logada.
     */
    suspend fun registerOnce(uid: String) {
        if (registeredUid == uid) return
        val token = runCatching { messaging.token.await() }.getOrNull() ?: return
        if (registerToken(token)) registeredUid = uid
    }

    /**
     * Manda um token ao backend.
     *
     * @param token Token do FCM.
     * @return Se o backend aceitou.
     */
    suspend fun registerToken(token: String): Boolean = try {
        backend.registerDevice(token)
        true
    } catch (error: BackendException) {
        Log.w(TAG, "Token não registrado", error)
        false
    }

    /**
     * Antes de sair da conta: tira o token do backend (enquanto ainda há sessão para autenticar) e
     * apaga o token local, para o aparelho não receber avisos da conta anterior.
     */
    suspend fun unregister() {
        registeredUid = null
        val token = runCatching { messaging.token.await() }.getOrNull()
        if (token != null) {
            try {
                backend.unregisterDevice(token)
            } catch (error: BackendException) {
                // Sem rede: o token antigo some do backend quando o FCM o recusar no próximo envio.
                Log.w(TAG, "Token não removido do backend", error)
            }
        }
        runCatching { messaging.deleteToken().await() }
            .onFailure { Log.w(TAG, "Token local não apagado", it) }
    }

    private companion object {
        const val TAG = "DeviceRegistration"

        // Do processo, porque o MainScreen é recriado a cada troca de lista.
        @Volatile
        var registeredUid: String? = null
    }
}
