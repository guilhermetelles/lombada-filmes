package io.github.guilhermetelles.lombada.domain

/**
 * Porte da `fractional-indexing` 4.0.0 (a mesma do backend), com os dígitos padrão: chaves em
 * base 62 (`0-9A-Za-z`) com a parte inteira começando por `A-Za-z`. As chaves geradas aqui e no
 * backend ordenam igual, por comparação simples de texto.
 */
object FractionalIndex {
    private const val DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    private const val INT_DIGITS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    private val SMALLEST_INTEGER = INT_DIGITS[0] + DIGITS[0].toString().repeat(INT_DIGITS.length / 2)

    /**
     * Gera uma chave entre duas, como `generateKeyBetween` da biblioteca.
     *
     * @param a Chave de baixo, ou null para "antes de todas".
     * @param b Chave de cima, ou null para "depois de todas".
     * @return Chave que ordena entre [a] e [b].
     * @throws IllegalArgumentException Com chave inválida ou [a] igual a [b].
     */
    fun keyBetween(a: String?, b: String?): String {
        a?.let(::validateOrderKey)
        b?.let(::validateOrderKey)
        var low = a
        var high = b
        // Como na versão 4 da biblioteca, a ordem dos argumentos não importa.
        if (low != null && high != null && low > high) {
            low = high.also { high = low }
        }
        if (low == null) {
            if (high == null) return INT_DIGITS[INT_DIGITS.length / 2] + DIGITS[0].toString()
            val ib = integerPart(high)
            val fb = high.substring(ib.length)
            if (ib == SMALLEST_INTEGER) return ib + midpoint("", fb)
            if (ib < high) return ib
            return decrementInteger(ib) ?: throw IllegalArgumentException("cannot decrement any more")
        }
        if (high == null) {
            val ia = integerPart(low)
            val fa = low.substring(ia.length)
            return incrementInteger(ia) ?: (ia + midpoint(fa, null))
        }
        val ia = integerPart(low)
        val fa = low.substring(ia.length)
        val ib = integerPart(high)
        val fb = high.substring(ib.length)
        if (ia == ib) return ia + midpoint(fa, fb)
        val i = incrementInteger(ia) ?: throw IllegalArgumentException("cannot increment any more")
        if (i < high) return i
        return ia + midpoint(fa, null)
    }

    /**
     * Gera [n] chaves em ordem entre duas, como `generateNKeysBetween`.
     *
     * @param a Chave de baixo, ou null.
     * @param b Chave de cima, ou null.
     * @param n Quantidade.
     * @return Chaves em ordem crescente.
     */
    fun keysBetween(a: String?, b: String?, n: Int): List<String> {
        if (n == 0) return emptyList()
        if (n == 1) return listOf(keyBetween(a, b))
        if (b == null) {
            var c = keyBetween(a, null)
            val result = mutableListOf(c)
            repeat(n - 1) {
                c = keyBetween(c, null)
                result += c
            }
            return result
        }
        if (a == null) {
            var c = keyBetween(null, b)
            val result = mutableListOf(c)
            repeat(n - 1) {
                c = keyBetween(null, c)
                result += c
            }
            return result.reversed()
        }
        val mid = n / 2
        val c = keyBetween(a, b)
        return keysBetween(a, c, mid) + c + keysBetween(c, b, n - mid - 1)
    }

    private fun digit(c: Char): Int = DIGITS.indexOf(c)

    private fun midpoint(a: String, b: String?): String {
        val zero = DIGITS[0]
        require(b == null || a < b) { "$a >= $b" }
        require(a.lastOrNull() != zero && (b.isNullOrEmpty() || b.last() != zero)) { "trailing zero" }
        // take/drop toleram índices além do fim, como o slice() do JavaScript.
        if (!b.isNullOrEmpty()) {
            var n = 0
            while (n < b.length && (a.getOrNull(n) ?: zero) == b[n]) n++
            if (n > 0) return b.take(n) + midpoint(a.drop(n), b.drop(n))
        }
        val digitA = if (a.isNotEmpty()) digit(a[0]) else 0
        val digitB = if (b != null) digit(b[0]) else DIGITS.length
        if (digitB - digitA > 1) {
            // Math.round do JavaScript arredonda .5 para cima.
            return DIGITS[Math.floorDiv(digitA + digitB + 1, 2)].toString()
        }
        if (b != null && b.length > 1) return b.take(1)
        return DIGITS[digitA] + midpoint(a.drop(1), null)
    }

    private fun integerLength(head: Char): Int {
        val i = INT_DIGITS.indexOf(head)
        require(i >= 0) { "invalid order key head: $head" }
        val half = INT_DIGITS.length / 2
        return if (i < half) half - i + 1 else i - half + 2
    }

    private fun integerPart(key: String): String {
        val length = integerLength(key[0])
        require(length <= key.length) { "invalid order key: $key" }
        return key.substring(0, length)
    }

    private fun validateOrderKey(key: String) {
        require(key.isNotEmpty() && key != SMALLEST_INTEGER) { "invalid order key: $key" }
        val i = integerPart(key)
        require(key.substring(i.length).lastOrNull() != DIGITS[0]) { "invalid order key: $key" }
    }

    private fun validateInteger(x: String) {
        require(x.length == integerLength(x[0])) { "invalid integer part of order key: $x" }
    }

    private fun incrementInteger(x: String): String? {
        validateInteger(x)
        val head = x[0]
        var trailing = ""
        for (i in x.length - 1 downTo 1) {
            val d = digit(x[i]) + 1
            if (d == DIGITS.length) {
                trailing = DIGITS[0] + trailing
            } else {
                return head + x.substring(1, i) + DIGITS[d] + trailing
            }
        }
        val headIndex = INT_DIGITS.indexOf(head)
        if (headIndex == INT_DIGITS.length - 1) return null
        val h = INT_DIGITS[headIndex + 1]
        val lengthDelta = integerLength(h) - integerLength(head)
        return h +
            when {
                lengthDelta > 0 -> trailing + DIGITS[0]
                lengthDelta < 0 -> trailing.drop(1)
                else -> trailing
            }
    }

    private fun decrementInteger(x: String): String? {
        validateInteger(x)
        val head = x[0]
        val last = DIGITS.last()
        var trailing = ""
        for (i in x.length - 1 downTo 1) {
            val d = digit(x[i]) - 1
            if (d == -1) {
                trailing = last + trailing
            } else {
                return head + x.substring(1, i) + DIGITS[d] + trailing
            }
        }
        val headIndex = INT_DIGITS.indexOf(head)
        if (headIndex == 0) return null
        val h = INT_DIGITS[headIndex - 1]
        val lengthDelta = integerLength(h) - integerLength(head)
        return h +
            when {
                lengthDelta > 0 -> trailing + last
                lengthDelta < 0 -> trailing.drop(1)
                else -> trailing
            }
    }
}
