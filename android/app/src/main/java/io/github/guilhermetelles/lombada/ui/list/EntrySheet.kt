package io.github.guilhermetelles.lombada.ui.list

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.guilhermetelles.lombada.data.model.MovieSnapshot
import io.github.guilhermetelles.lombada.ui.components.LombadaButton
import io.github.guilhermetelles.lombada.ui.components.LombadaButtonStyle
import io.github.guilhermetelles.lombada.ui.components.LombadaTextField
import io.github.guilhermetelles.lombada.ui.components.MovieCover
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import java.time.LocalDate

/**
 * Folha de baixo para registrar ou editar um filme: data assistida, comentário e, na edição,
 * "Remover da lista". Ao registrar, a data é obrigatória e começa em hoje.
 *
 * @param movie Filme.
 * @param tmdbId Id do filme, para a cor da capa.
 * @param subtitle "#3 na lista" ou "Entra como #92; depois é só arrastar".
 * @param initialDate Data atual da entrada.
 * @param initialComment Comentário atual.
 * @param adding Se é um registro novo.
 * @param onSave Salva com a data e o comentário.
 * @param onRemove Remove da lista, só na edição.
 * @param onDismiss Fecha sem salvar.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EntrySheet(
    movie: MovieSnapshot,
    tmdbId: Int,
    subtitle: String,
    initialDate: LocalDate?,
    initialComment: String,
    adding: Boolean,
    onSave: (LocalDate?, String) -> Unit,
    onRemove: (() -> Unit)?,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var date by rememberSaveable { mutableStateOf(if (adding) LocalDate.now() else initialDate) }
    var comment by rememberSaveable { mutableStateOf(initialComment) }
    var dateError by rememberSaveable { mutableStateOf<String?>(null) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = LombadaColors.Shelf,
        contentColor = LombadaColors.Paper,
        scrimColor = LombadaColors.Scrim
    ) {
        Column(
            modifier =
                Modifier
                    .verticalScroll(rememberScrollState())
                    .navigationBarsPadding()
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 30.dp)
        ) {
            Text(
                if (adding) "Registrar filme" else "Editar registro",
                style = MaterialTheme.typography.headlineSmall.copy(fontSize = 24.sp),
                modifier = Modifier.semantics { heading() }.padding(bottom = 14.dp)
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.padding(bottom = 20.dp)
            ) {
                MovieCover(movie.title, movie.posterPath, tmdbId, Modifier.width(44.dp), initialsSize = 13.sp)
                Column {
                    Text(
                        movie.title,
                        style = MaterialTheme.typography.titleMedium.copy(fontSize = 18.sp, lineHeight = 21.sp)
                    )
                    Text(
                        subtitle,
                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.5.sp),
                        color = LombadaColors.Paper2,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
            }
            WatchedDateField(
                date = date,
                onDateChange = {
                    date = it
                    dateError = null
                },
                allowEmpty = !adding,
                error = dateError,
                modifier = Modifier.padding(bottom = 16.dp)
            )
            LombadaTextField(
                value = comment,
                onValueChange = { comment = it.take(5_000) },
                label = "Comentário",
                placeholder = "O que vocês acharam?",
                singleLine = false,
                minLines = 5,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                modifier = Modifier.padding(bottom = 16.dp)
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End), modifier = Modifier.fillMaxWidth()) {
                LombadaButton("Cancelar", onClick = onDismiss, style = LombadaButtonStyle.Text)
                LombadaButton(
                    if (adding) "Adicionar" else "Salvar",
                    onClick = {
                        if (adding && date == null) {
                            dateError = "Escolha a data em que vocês viram o filme."
                        } else {
                            onSave(date, comment)
                        }
                    }
                )
            }
            if (onRemove != null) {
                HorizontalDivider(color = LombadaColors.Rule, modifier = Modifier.padding(top = 20.dp, bottom = 16.dp))
                OutlinedButton(
                    onClick = onRemove,
                    border = BorderStroke(1.dp, LombadaColors.Error.copy(alpha = 0.5f)),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = LombadaColors.Error),
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .heightIn(min = 48.dp)
                ) {
                    Icon(Icons.Filled.Delete, contentDescription = null, modifier = Modifier.padding(end = 8.dp))
                    Text("Remover da lista")
                }
            }
        }
    }
}
