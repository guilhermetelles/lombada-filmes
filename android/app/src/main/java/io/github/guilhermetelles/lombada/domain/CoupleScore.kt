package io.github.guilhermetelles.lombada.domain

/** Nota de vocês, derivada da posição: 10 para o 1º, 1 para o último, com o mesmo espaço entre cada. */
object CoupleScore {
    /**
     * Calcula a nota de uma posição.
     *
     * @param rank Posição, a partir de 1.
     * @param total Quantidade de filmes na lista.
     * @return Nota de 1 a 10; 10 quando a lista tem um filme só.
     */
    fun of(rank: Int, total: Int): Double = if (total <= 1) 10.0 else 1 + 9.0 * (total - rank) / (total - 1)
}
