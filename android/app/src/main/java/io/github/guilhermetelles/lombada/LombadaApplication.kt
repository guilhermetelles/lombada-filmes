package io.github.guilhermetelles.lombada

import android.app.Application

/** Guarda o [AppContainer] do processo. */
class LombadaApplication : Application() {
    /** Dependências do app. */
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
