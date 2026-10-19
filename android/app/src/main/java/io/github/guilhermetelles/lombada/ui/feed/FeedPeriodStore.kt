package io.github.guilhermetelles.lombada.ui.feed

import android.content.Context
import androidx.core.content.edit
import io.github.guilhermetelles.lombada.domain.FeedPeriod

/**
 * Guarda no aparelho o período escolhido na Atividade, para valer na próxima vez.
 *
 * @param context Contexto do app.
 */
class FeedPeriodStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("feed", Context.MODE_PRIVATE)

    /**
     * Lê o período guardado.
     *
     * @return O período; [FeedPeriod.DEFAULT] se nunca foi escolhido.
     */
    fun read(): FeedPeriod = FeedPeriod.fromKey(prefs.getString(KEY, null))

    /**
     * Guarda o período escolhido.
     *
     * @param period Período.
     */
    fun save(period: FeedPeriod) {
        prefs.edit { putString(KEY, period.name) }
    }

    private companion object {
        const val KEY = "period"
    }
}
