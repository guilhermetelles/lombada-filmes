package io.github.guilhermetelles.lombada.data.backend

/** Códigos de erro do backend, mais os dois do lado do app (sem rede e resposta inesperada). */
enum class BackendErrorCode {
    INVALID_INPUT,
    UNAUTHENTICATED,
    FORBIDDEN,
    NOT_FOUND,
    ALREADY_ANSWERED,
    NOT_TODAY,
    CONFLICT,
    INVITE_EXPIRED,
    SOURCE_UNAVAILABLE,
    RATE_LIMITED,
    INTERNAL,
    NETWORK,
    UNKNOWN
    ;

    companion object {
        /**
         * Converte o `code` da resposta.
         *
         * @param code Valor de `error.code`, como `invite_expired`.
         * @return O código correspondente, ou [UNKNOWN].
         */
        fun fromWire(code: String): BackendErrorCode =
            entries.firstOrNull { it.name.equals(code, ignoreCase = true) } ?: UNKNOWN
    }
}

/**
 * Falha numa chamada ao backend, já tipada.
 *
 * @property code O que deu errado.
 * @property status Status HTTP, ou null sem resposta.
 */
class BackendException(val code: BackendErrorCode, message: String, val status: Int? = null, cause: Throwable? = null) :
    Exception(message, cause)
