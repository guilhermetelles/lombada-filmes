package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Scores
import java.time.YearMonth

/**
 * Uma linha do placar do mês.
 *
 * @property uid Membro.
 * @property points Pontos no mês.
 * @property isMe Se é a pessoa logada.
 */
data class ScoreRow(val uid: String, val points: Int, val isMe: Boolean)

/**
 * Números de um membro nos detalhes da lista.
 *
 * @property uid Membro.
 * @property monthPoints Pontos no mês atual.
 * @property monthsWon Meses fechados que venceu (empate conta para os dois).
 * @property total Pontos somados em todos os meses guardados.
 * @property isMe Se é a pessoa logada.
 */
data class MemberRecord(val uid: String, val monthPoints: Int, val monthsWon: Int, val total: Int, val isMe: Boolean)

/**
 * Um mês na lista dos últimos meses.
 *
 * @property month Mês `AAAA-MM`.
 * @property points Pontos de cada membro atual, na ordem dos membros.
 * @property winnerUids Vencedores gravados pelo backend; vazio no mês atual ou antes de fechar.
 * @property current Se é o mês em andamento.
 */
data class MonthSummary(
    val month: String,
    val points: List<Pair<String, Int>>,
    val winnerUids: List<String>,
    val current: Boolean
)

/** Placar do quiz: ordem das linhas, recordes por membro e os últimos meses. */
object QuizScoreboard {
    private val MONTHS =
        listOf(
            "janeiro", "fevereiro", "março", "abril", "maio", "junho",
            "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
        )

    /**
     * Linhas do placar de um mês: todos os membros atuais, de quem tem mais pontos para quem tem
     * menos; empate mantém a ordem dos membros.
     *
     * @param memberUids Membros atuais da lista, na ordem de `memberUids`.
     * @param scores Placar do mês, ou null antes da primeira resposta.
     * @param me Pessoa logada.
     * @return As linhas.
     */
    fun rows(memberUids: List<String>, scores: Scores?, me: String): List<ScoreRow> = memberUids
        .map { ScoreRow(it, scores?.points?.get(it) ?: 0, it == me) }
        .sortedByDescending { it.points }

    /**
     * Recordes de cada membro atual, na mesma ordem de [rows] para o mês atual.
     *
     * @param memberUids Membros atuais.
     * @param history Placares guardados, em qualquer ordem.
     * @param currentMonth Mês atual `AAAA-MM`.
     * @param me Pessoa logada.
     * @return Um recorde por membro.
     */
    fun records(memberUids: List<String>, history: List<Scores>, currentMonth: String, me: String): List<MemberRecord> {
        val current = history.firstOrNull { it.month == currentMonth }
        return rows(memberUids, current, me).map { row ->
            MemberRecord(
                uid = row.uid,
                monthPoints = row.points,
                monthsWon = history.count { it.month < currentMonth && row.uid in it.winnerUids },
                total = history.sumOf { it.points[row.uid] ?: 0 },
                isMe = row.isMe
            )
        }
    }

    /**
     * Os últimos meses com placar, do atual para trás, até [count] meses de calendário.
     *
     * @param memberUids Membros atuais.
     * @param history Placares guardados.
     * @param currentMonth Mês atual `AAAA-MM`.
     * @param count Quantos meses de calendário olhar, contando o atual.
     * @return Os meses que têm placar guardado, do mais recente para o mais antigo.
     */
    fun recentMonths(
        memberUids: List<String>,
        history: List<Scores>,
        currentMonth: String,
        count: Int = 6
    ): List<MonthSummary> {
        val byMonth = history.associateBy { it.month }
        val start = YearMonth.parse(currentMonth)
        return (0 until count).mapNotNull { back ->
            val month = start.minusMonths(back.toLong()).toString()
            val scores = byMonth[month] ?: return@mapNotNull null
            MonthSummary(
                month = month,
                points = memberUids.map { it to (scores.points[it] ?: 0) },
                winnerUids = if (month == currentMonth) emptyList() else scores.winnerUids,
                current = month == currentMonth
            )
        }
    }

    /**
     * Placar do mês passado, quando já tem vencedor gravado.
     *
     * @param history Placares guardados.
     * @param currentMonth Mês atual `AAAA-MM`.
     * @return O placar com `winnerUids`, ou null.
     */
    fun lastMonthWinners(history: List<Scores>, currentMonth: String): Scores? {
        val previous = YearMonth.parse(currentMonth).minusMonths(1).toString()
        return history.firstOrNull { it.month == previous && it.winnerUids.isNotEmpty() }
    }

    /**
     * Nome do mês por extenso.
     *
     * @param month Mês `AAAA-MM`.
     * @return Por exemplo "outubro de 2026".
     */
    fun monthLabel(month: String): String {
        val parsed = YearMonth.parse(month)
        return "${MONTHS[parsed.monthValue - 1]} de ${parsed.year}"
    }

    /**
     * Só o nome do mês.
     *
     * @param month Mês `AAAA-MM`.
     * @return Por exemplo "outubro".
     */
    fun monthName(month: String): String = MONTHS[YearMonth.parse(month).monthValue - 1]
}
