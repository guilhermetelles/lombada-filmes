package io.github.guilhermetelles.lombada.data.firestore

import com.google.firebase.firestore.FirebaseFirestoreException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch

/**
 * Encerra o fluxo em silêncio quando as regras passam a negar a leitura, como depois de sair de
 * uma lista ou de sair da conta, em vez de derrubar a tela que ainda escuta.
 *
 * @return O mesmo fluxo, sem o erro de permissão.
 */
fun <T> Flow<T>.endOnPermissionDenied(): Flow<T> = catch { error ->
    if (error !is FirebaseFirestoreException ||
        error.code != FirebaseFirestoreException.Code.PERMISSION_DENIED
    ) {
        throw error
    }
}
