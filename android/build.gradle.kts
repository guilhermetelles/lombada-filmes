plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.google.services) apply false
    alias(libs.plugins.spotless)
}

// Formatação e lint do Kotlin com ktlint: `./gradlew spotlessCheck` confere, `spotlessApply` corrige.
spotless {
    kotlin {
        target("app/src/**/*.kt")
        ktlint(libs.versions.ktlint.get()).editorConfigOverride(
            mapOf(
                // Funções @Composable começam com maiúscula, como manda o guia do Compose.
                "ktlint_function_naming_ignore_when_annotated_with" to "Composable"
            )
        )
    }
    kotlinGradle {
        target("*.gradle.kts", "app/*.gradle.kts")
        ktlint(libs.versions.ktlint.get())
    }
}
