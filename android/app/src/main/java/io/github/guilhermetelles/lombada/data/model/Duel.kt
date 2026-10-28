package io.github.guilhermetelles.lombada.data.model

/** Voto de um membro no duelo. */
enum class DuelChoice(val wire: String) {
    KEEP("keep"),
    SWAP("swap");

    companion object {
        /**
         * Converte o valor gravado.
         *
         * @param value `keep` ou `swap`.
         * @return O voto, ou null para um valor desconhecido.
         */
        fun fromWire(value: String?): DuelChoice? = entries.firstOrNull { it.wire == value }
    }
}

/** Situação do duelo do dia. */
enum class DuelStatus(val wire: String) {
    OPEN("open"),
    KEPT("kept"),
    SWAPPED("swapped");

    companion object {
        /**
         * Converte o valor gravado.
         *
         * @param value `open`, `kept` ou `swapped`.
         * @return A situação, ou null para um valor desconhecido.
         */
        fun fromWire(value: String?): DuelStatus? = entries.firstOrNull { it.wire == value }
    }
}

/**
 * Duelo de revisão do dia em `lists/{listId}/duels/{dia}`. A ordem só muda com todos votando
 * [DuelChoice.SWAP]; um [DuelChoice.KEEP] fecha o duelo.
 *
 * @property day Dia `AAAA-MM-DD` em Brasília.
 * @property entryIdA Entrada que estava na frente quando o duelo foi aberto.
 * @property entryIdB A outra entrada.
 * @property status Aberto, mantido ou trocado.
 * @property votes Voto de cada membro, por uid.
 */
data class Duel(
    val day: String,
    val entryIdA: String,
    val entryIdB: String,
    val status: DuelStatus,
    val votes: Map<String, DuelChoice>
)
