package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.Movie
import kotlin.math.roundToInt

/**
 * Pedaço de texto de uma curiosidade; [strong] sai em destaque.
 *
 * @property text Texto.
 * @property strong Se vai em negrito.
 */
data class CurioPart(val text: String, val strong: Boolean = false)

/**
 * Uma linha de "Curiosidades": rótulo e texto.
 *
 * @property label Rótulo, como "No Brasil" ou "Dinheiro".
 * @property parts Texto em pedaços.
 */
data class CurioRow(val label: String, val parts: List<CurioPart>) {
    /** Texto corrido, sem destaque (leitor de tela e testes). */
    val plain: String get() = parts.joinToString("") { it.text }
}

/**
 * Seção "Curiosidades" do filme, só com o que existir.
 *
 * @property tagline Slogan em português, sem aspas.
 * @property rows Linhas na ordem da tela.
 * @property providers Streaming por assinatura no Brasil.
 */
data class Curiosities(val tagline: String?, val rows: List<CurioRow>, val providers: List<String>) {
    /** Se não há nada para mostrar: a seção some. */
    val isEmpty: Boolean get() = tagline == null && rows.isEmpty() && providers.isEmpty()

    companion object {
        /**
         * Monta as curiosidades a partir dos campos extras de `movies/{tmdbId}`.
         *
         * @param movie Filme.
         * @return As curiosidades; [isEmpty] quando o backend ainda não buscou nada.
         */
        fun of(movie: Movie): Curiosities {
            val rows = mutableListOf<CurioRow>()
            movie.titlePt
                ?.trim()
                ?.takeIf { it.isNotEmpty() && !it.equals(movie.title.trim(), ignoreCase = true) }
                ?.let { rows += CurioRow("No Brasil", listOf(CurioPart(it, strong = true))) }
            money(movie.budget, movie.revenue)?.let { rows += it }
            movie.boxOfficeUS?.takeIf { it > 0 }?.let { us ->
                val share = movie.revenue?.takeIf {
                    it > 0
                }?.let { ", ${(us * 100.0 / it).roundToInt()}% do total" }.orEmpty()
                rows +=
                    CurioRow(
                        "Nos EUA",
                        listOf(
                            CurioPart("Bilheteria de "),
                            CurioPart(PortugueseText.money(us), strong = true),
                            CurioPart("$share.")
                        )
                    )
            }
            movie.certBR?.trim()?.takeIf { it.isNotEmpty() }?.let { cert ->
                rows += CurioRow("Classificação", listOf(CurioPart(certificationText(cert), strong = true)))
            }
            movie.collection?.let { rows += CurioRow("Saga", listOf(CurioPart(it.name, strong = true))) }
            return Curiosities(
                tagline = movie.tagline?.trim()?.trim('"', '“', '”')?.takeIf { it.isNotEmpty() },
                rows = rows,
                providers = movie.providersBR?.flatrate.orEmpty()
            )
        }

        /**
         * Classificação indicativa por extenso.
         *
         * @param cert Valor do TMDb para o Brasil ("L", "12", "16"…).
         * @return "Livre para todos os públicos", "12 anos" ou o próprio valor.
         */
        fun certificationText(cert: String): String = when {
            cert.equals("L", ignoreCase = true) -> "Livre para todos os públicos"
            cert.all(Char::isDigit) -> "$cert anos"
            else -> cert
        }

        private fun money(budget: Long?, revenue: Long?): CurioRow? {
            val spent = budget?.takeIf { it > 0 }
            val earned = revenue?.takeIf { it > 0 }
            return when {
                spent != null && earned != null -> {
                    val ratio = earned.toDouble() / spent
                    val start =
                        listOf(
                            CurioPart("Custou "),
                            CurioPart(PortugueseText.money(spent), strong = true),
                            CurioPart(" e faturou "),
                            CurioPart(PortugueseText.money(earned), strong = true)
                        )
                    val end =
                        if (ratio >= 1) {
                            val times = PortugueseText.oneDecimal(ratio)
                            " no mundo, $times ${if (ratio < 1.95) "vez" else "vezes"} o orçamento."
                        } else {
                            " no mundo: não se pagou nas bilheterias (${(ratio * 100).roundToInt()}% do orçamento)."
                        }
                    CurioRow("Dinheiro", start + CurioPart(end))
                }

                spent != null -> CurioRow("Orçamento", listOf(CurioPart(PortugueseText.money(spent), strong = true)))

                earned != null -> {
                    CurioRow("Bilheteria mundial", listOf(CurioPart(PortugueseText.money(earned), strong = true)))
                }

                else -> null
            }
        }
    }
}
