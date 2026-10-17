package io.github.guilhermetelles.lombada.domain

/** Código de convite: 6 caracteres sem 0/O, 1/I/L, guardado sem traço e mostrado como `ABC-123`. */
object InviteCode {
    /** Caracteres que o backend usa para gerar códigos. */
    const val ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

    /** Tamanho do código, sem o traço. */
    const val LENGTH = 6

    /**
     * Deixa só letras e números, em maiúsculas, como o backend faz ao receber o código.
     *
     * @param typed Texto digitado, com ou sem traço e espaços.
     * @return Código normalizado, que pode ter mais ou menos de 6 caracteres.
     */
    fun normalize(typed: String): String = typed.uppercase().filter { it in 'A'..'Z' || it in '0'..'9' }

    /**
     * Formata para mostrar, com o traço no meio a partir do 4º caractere.
     *
     * @param code Código normalizado, completo ou pela metade.
     * @return `ABC-123`, ou o próprio texto quando tem até 3 caracteres.
     */
    fun format(code: String): String = if (code.length > 3) "${code.take(3)}-${code.drop(3)}" else code

    /**
     * Diz se o código tem o formato que o backend aceita.
     *
     * @param code Código normalizado.
     * @return true com 6 caracteres do alfabeto.
     */
    fun isWellFormed(code: String): Boolean = code.length == LENGTH && code.all { it in ALPHABET }
}
