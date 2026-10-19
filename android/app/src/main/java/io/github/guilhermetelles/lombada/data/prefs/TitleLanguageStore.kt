package io.github.guilhermetelles.lombada.data.prefs

import android.content.Context
import androidx.core.content.edit
import io.github.guilhermetelles.lombada.domain.TitleLanguage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Idioma dos títulos dos filmes, guardado no aparelho (vale só neste celular).
 *
 * @param context Contexto do app.
 */
class TitleLanguageStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("options", Context.MODE_PRIVATE)
    private val current = MutableStateFlow(TitleLanguage.fromKey(prefs.getString(KEY, null)))

    /** Idioma escolhido; [TitleLanguage.DEFAULT] se nunca foi escolhido. */
    val language: StateFlow<TitleLanguage> = current.asStateFlow()

    /**
     * Guarda o idioma escolhido e avisa as telas abertas.
     *
     * @param language Idioma.
     */
    fun save(language: TitleLanguage) {
        prefs.edit { putString(KEY, language.key) }
        current.value = language
    }

    private companion object {
        const val KEY = "titleLanguage"
    }
}
