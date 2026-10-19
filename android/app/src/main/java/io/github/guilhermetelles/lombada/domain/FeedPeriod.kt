package io.github.guilhermetelles.lombada.domain

import java.time.Duration
import java.time.Instant

/**
 * Período da Atividade, combinado com o [FeedFilter] de tipo.
 *
 * @property label Rótulo do chip.
 */
enum class FeedPeriod(val label: String) {
    /** Só o que chegou desde a visita anterior. */
    New("Novas"),

    /** Últimas 24 horas. */
    Day("24 horas"),

    /** Últimos 7 dias. */
    Week("7 dias"),

    /** Últimos 30 dias. */
    Month("30 dias"),

    /** Sem corte. */
    All("Tudo");

    companion object {
        /** Período de quem nunca escolheu. */
        val DEFAULT = Week

        /**
         * Lê o período guardado no aparelho.
         *
         * @param key Nome guardado ([name]); null ou desconhecido vira [DEFAULT].
         * @return O período.
         */
        fun fromKey(key: String?): FeedPeriod = entries.firstOrNull { it.name == key } ?: DEFAULT
    }
}

/**
 * Texto do estado vazio da Atividade.
 *
 * @property title Linha principal.
 * @property body Explicação.
 * @property offerAll Se mostra o botão "Ver tudo", que troca o período para [FeedPeriod.All].
 */
data class FeedEmptyMessage(val title: String, val body: String, val offerAll: Boolean)

/** Corte de período da Atividade, a partir de agora e da visita anterior. */
object FeedPeriods {
    /**
     * Início do período: só os itens depois dele aparecem.
     *
     * @param period Período escolhido.
     * @param now Agora.
     * @param seenBefore Quando a pessoa tinha aberto a Atividade antes desta vez (`feedSeenAt` lido antes de
     *   marcar como visto); null se nunca abriu, e aí tudo é novidade.
     * @return O corte, ou null para não cortar.
     */
    fun since(period: FeedPeriod, now: Instant, seenBefore: Instant?): Instant? = when (period) {
        FeedPeriod.New -> seenBefore
        FeedPeriod.Day -> now.minus(Duration.ofDays(1))
        FeedPeriod.Week -> now.minus(Duration.ofDays(7))
        FeedPeriod.Month -> now.minus(Duration.ofDays(30))
        FeedPeriod.All -> null
    }

    /**
     * Se um item entra no período.
     *
     * @param createdAt Quando o item foi criado; null (ainda sem horário do servidor) conta como agora.
     * @param since Corte de [since]; null aceita tudo.
     * @return true se o item é depois do corte.
     */
    fun includes(createdAt: Instant?, since: Instant?): Boolean =
        since == null || createdAt == null || createdAt.isAfter(since)

    /**
     * Estado vazio para a combinação de período e tipo.
     *
     * @param period Período escolhido.
     * @param filter Tipo escolhido.
     * @return Título, explicação e se vale oferecer "Ver tudo".
     */
    fun emptyMessage(period: FeedPeriod, filter: FeedFilter): FeedEmptyMessage {
        val anyKind = filter == FeedFilter.All
        val title =
            when (period) {
                FeedPeriod.New -> "Nada novo desde a sua última visita."

                FeedPeriod.Day -> "Nada nas últimas 24 horas."

                FeedPeriod.Week -> "Nada nos últimos 7 dias."

                FeedPeriod.Month -> "Nada nos últimos 30 dias."

                FeedPeriod.All ->
                    return if (anyKind) {
                        FeedEmptyMessage(
                            "Nada por aqui ainda",
                            "O que vocês fizerem na lista, o quiz, as curiosidades e os lembretes do dia aparecem aqui.",
                            offerAll = false
                        )
                    } else {
                        FeedEmptyMessage(
                            "Nada desse tipo ainda",
                            "Quando chegar um aviso desse tipo, ele aparece aqui.",
                            offerAll = false
                        )
                    }
            }
        val body =
            if (anyKind) {
                "Os avisos mais antigos continuam em Tudo."
            } else {
                "Nenhum aviso desse tipo neste período. Os mais antigos continuam em Tudo."
            }
        return FeedEmptyMessage(title, body, offerAll = true)
    }
}
