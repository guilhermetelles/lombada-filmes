package io.github.guilhermetelles.lombada.data.auth

import android.content.Context
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

/** Falha ao entrar com Google; [cancelled] quando a própria pessoa fechou a janela. */
class SignInException(message: String, val cancelled: Boolean = false, cause: Throwable? = null) :
    Exception(message, cause)

/**
 * Login com Google pelo Credential Manager, trocado por uma sessão do Firebase Auth.
 *
 * @param auth Instância do Firebase Auth.
 * @param webClientId Client ID do tipo web do projeto (`default_web_client_id`).
 */
class AuthRepository(private val auth: FirebaseAuth, private val webClientId: String) {
    /** Uid de quem está logado agora, se houver. */
    val currentUid: String? get() = auth.currentUser?.uid

    /** Nome e e-mail da conta logada, para a tela "Sobre". */
    val currentAccount: Pair<String?, String?> get() = auth.currentUser.let { it?.displayName to it?.email }

    /**
     * Acompanha a sessão.
     *
     * @return Fluxo com a pessoa logada, ou null quando ninguém está.
     */
    fun observeUser(): Flow<FirebaseUser?> = callbackFlow {
        val listener = FirebaseAuth.AuthStateListener { trySend(it.currentUser) }
        auth.addAuthStateListener(listener)
        awaitClose { auth.removeAuthStateListener(listener) }
    }

    /**
     * Abre a janela "Entrar com Google" e entra no Firebase com a conta escolhida.
     *
     * @param activityContext Contexto da Activity, que o Credential Manager usa para a janela.
     * @return A pessoa logada.
     * @throws SignInException Quando a pessoa cancela ou o Google ou o Firebase recusam.
     */
    suspend fun signInWithGoogle(activityContext: Context): FirebaseUser {
        val request =
            GetCredentialRequest
                .Builder()
                .addCredentialOption(GetSignInWithGoogleOption.Builder(webClientId).build())
                .build()
        val credential =
            try {
                CredentialManager.create(activityContext).getCredential(activityContext, request).credential
            } catch (error: GetCredentialCancellationException) {
                throw SignInException("Login cancelado.", cancelled = true, cause = error)
            } catch (error: NoCredentialException) {
                throw SignInException(
                    "Nenhuma conta Google neste celular. Adicione uma nas configurações.",
                    cause = error
                )
            } catch (error: GetCredentialException) {
                throw SignInException("Não foi possível entrar com Google.", cause = error)
            }
        if (credential !is CustomCredential ||
            credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) {
            throw SignInException("O Google devolveu uma credencial inesperada.")
        }
        val idToken = GoogleIdTokenCredential.createFrom(credential.data).idToken
        return try {
            auth.signInWithCredential(GoogleAuthProvider.getCredential(idToken, null)).await().user
                ?: throw SignInException("O Firebase não devolveu a conta.")
        } catch (error: SignInException) {
            throw error
        } catch (error: Exception) {
            throw SignInException("O Firebase recusou o login.", cause = error)
        }
    }

    /**
     * Sai da conta no app e esquece a conta escolhida no Credential Manager.
     *
     * @param context Qualquer contexto do app.
     */
    suspend fun signOut(context: Context) {
        auth.signOut()
        runCatching { CredentialManager.create(context).clearCredentialState(ClearCredentialStateRequest()) }
    }

    /**
     * ID token da sessão atual, renovado pelo SDK quando vence.
     *
     * @return Token para o cabeçalho `Authorization`, ou null sem login.
     */
    suspend fun idToken(): String? = auth.currentUser?.getIdToken(false)?.await()?.token
}
