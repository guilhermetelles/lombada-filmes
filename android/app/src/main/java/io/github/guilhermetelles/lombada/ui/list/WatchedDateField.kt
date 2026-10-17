package io.github.guilhermetelles.lombada.ui.list

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDefaults
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import io.github.guilhermetelles.lombada.domain.Formatting
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/**
 * Campo "Data assistida": mostra a data e abre o calendário. Datas futuras ficam bloqueadas.
 *
 * @param date Data escolhida, ou null.
 * @param onDateChange Nova data.
 * @param allowEmpty Se o calendário oferece "Sem data".
 * @param error Erro de validação, ou null.
 * @param modifier Modificador do Compose.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WatchedDateField(
    date: LocalDate?,
    onDateChange: (LocalDate?) -> Unit,
    allowEmpty: Boolean,
    error: String?,
    modifier: Modifier = Modifier
) {
    var picking by rememberSaveable { mutableStateOf(false) }
    val borderColor = if (error != null) LombadaColors.Error else LombadaColors.Rule
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("Data assistida", style = MaterialTheme.typography.labelMedium, color = LombadaColors.Paper2)
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 52.dp)
                    .border(BorderStroke(if (error != null) 2.dp else 1.dp, borderColor), RoundedCornerShape(8.dp))
                    .clickable(role = Role.Button, onClickLabel = "Escolher a data") { picking = true }
                    .padding(horizontal = 14.dp)
        ) {
            Text(
                date?.let(Formatting::fullDate) ?: "Sem data",
                style = MaterialTheme.typography.bodyLarge,
                color = if (date == null) LombadaColors.Paper3 else LombadaColors.Paper,
                modifier = Modifier.weight(1f)
            )
            Icon(Icons.Filled.CalendarMonth, contentDescription = null, tint = LombadaColors.Sticker)
        }
        if (error != null) Text(error, style = MaterialTheme.typography.bodySmall, color = LombadaColors.Error)
    }

    if (picking) {
        val today = LocalDate.now()
        val pickerState =
            rememberDatePickerState(
                initialSelectedDateMillis = (date ?: today).toUtcMillis(),
                selectableDates =
                    object : SelectableDates {
                        override fun isSelectableDate(utcTimeMillis: Long): Boolean =
                            utcTimeMillis <= today.toUtcMillis()

                        override fun isSelectableYear(year: Int): Boolean = year <= today.year
                    }
            )
        val colors =
            DatePickerDefaults.colors(
                containerColor = LombadaColors.Shelf,
                selectedDayContainerColor = LombadaColors.Sticker,
                selectedDayContentColor = LombadaColors.StickerInk,
                todayDateBorderColor = LombadaColors.Sticker,
                todayContentColor = LombadaColors.Sticker,
                selectedYearContainerColor = LombadaColors.Sticker,
                selectedYearContentColor = LombadaColors.StickerInk
            )
        DatePickerDialog(
            onDismissRequest = { picking = false },
            colors = colors,
            confirmButton = {
                TextButton(onClick = {
                    pickerState.selectedDateMillis?.let { onDateChange(it.toLocalDate()) }
                    picking = false
                }) { Text("OK", color = LombadaColors.Sticker) }
            },
            dismissButton = {
                Row {
                    if (allowEmpty) {
                        TextButton(onClick = {
                            onDateChange(null)
                            picking = false
                        }) { Text("Sem data", color = LombadaColors.Sticker) }
                    }
                    TextButton(onClick = { picking = false }) { Text("Cancelar", color = LombadaColors.Sticker) }
                }
            }
        ) {
            DatePicker(state = pickerState, colors = colors, modifier = Modifier.padding(bottom = 8.dp))
        }
    }
}

private fun LocalDate.toUtcMillis(): Long = atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()

private fun Long.toLocalDate(): LocalDate = Instant.ofEpochMilli(this).atZone(ZoneOffset.UTC).toLocalDate()
