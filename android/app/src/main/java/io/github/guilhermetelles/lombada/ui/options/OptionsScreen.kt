package io.github.guilhermetelles.lombada.ui.options

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import io.github.guilhermetelles.lombada.domain.TitleLanguage
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.feed.ScreenColumn
import io.github.guilhermetelles.lombada.ui.feed.SectionCard
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import io.github.guilhermetelles.lombada.ui.titleLanguage

private val LANGUAGES =
    listOf(
        TitleLanguage.Portuguese to "Português (padrão)",
        TitleLanguage.English to "Inglês"
    )

/**
 * Opções do app guardadas neste aparelho; por enquanto, o idioma dos títulos dos filmes.
 *
 * @param onBack Volta.
 */
@Composable
fun OptionsScreen(onBack: () -> Unit) {
    val store = appContainer().titleLanguage
    val selected = titleLanguage()
    ScreenColumn(title = "Opções", onBack = onBack) {
        SectionCard(
            title = "Títulos dos filmes",
            subtitle =
                "Vale para a lista, as páginas dos filmes, o Quero ver, as sugestões, a busca e os relatórios. " +
                    "Quando falta o título no idioma escolhido, aparece o outro. Textos prontos da Atividade, " +
                    "dos avisos e das perguntas do quiz ficam como vieram. Fica salvo só neste celular."
        ) {
            Column(modifier = Modifier.selectableGroup()) {
                LANGUAGES.forEach { (language, label) ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .heightIn(min = 48.dp)
                                .selectable(
                                    selected = language == selected,
                                    role = Role.RadioButton,
                                    onClick = { store.save(language) }
                                )
                    ) {
                        RadioButton(
                            selected = language == selected,
                            onClick = null,
                            colors =
                                RadioButtonDefaults.colors(
                                    selectedColor = LombadaColors.Sticker,
                                    unselectedColor = LombadaColors.Paper3
                                )
                        )
                        Text(
                            label,
                            style = MaterialTheme.typography.bodyLarge,
                            modifier = Modifier.padding(start = 12.dp)
                        )
                    }
                }
            }
        }
    }
}
