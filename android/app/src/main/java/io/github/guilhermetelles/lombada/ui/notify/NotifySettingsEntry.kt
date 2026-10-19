package io.github.guilhermetelles.lombada.ui.notify

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.NotificationsOff
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.guilhermetelles.lombada.data.model.NotifyPrefs
import io.github.guilhermetelles.lombada.data.model.NotifyTypes
import io.github.guilhermetelles.lombada.notify.NotificationPermissionState
import io.github.guilhermetelles.lombada.notify.rememberNotificationPermission
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.components.LombadaButton
import io.github.guilhermetelles.lombada.ui.components.LombadaButtonStyle
import io.github.guilhermetelles.lombada.ui.feed.ChoiceChips
import io.github.guilhermetelles.lombada.ui.feed.EmptyState
import io.github.guilhermetelles.lombada.ui.feed.LoadingBlock
import io.github.guilhermetelles.lombada.ui.feed.ScreenColumn
import io.github.guilhermetelles.lombada.ui.feed.SectionCard
import io.github.guilhermetelles.lombada.ui.feed.memberName
import io.github.guilhermetelles.lombada.ui.main.ScreenContext
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/** Frequências da notificação do dia, como no mock. */
val FREQUENCIES = listOf("Desligado" to 0, "Todo dia" to 1, "A cada 3 dias" to 3, "Toda semana" to 7)

private val HOURS = listOf("9h" to 9, "12h" to 12, "19h" to 19, "21h" to 21)

// Os 9 tipos da notificação do dia: rótulo, leitura e troca.
private val TYPES: List<Triple<String, (NotifyTypes) -> Boolean, (NotifyTypes, Boolean) -> NotifyTypes>> =
    listOf(
        Triple("Quiz do dia", { it.quiz }, { t, on -> t.copy(quiz = on) }),
        Triple("Curiosidade sobre um filme da lista", { it.curio }, { t, on -> t.copy(curio = on) }),
        Triple("Comentário do dia", { it.memory }, { t, on -> t.copy(memory = on) }),
        Triple("Retrospectiva do mês", { it.retro }, { t, on -> t.copy(retro = on) }),
        Triple("Estreias de quem vocês gostam", { it.release }, { t, on -> t.copy(release = on) }),
        Triple("Chegou no streaming", { it.streaming }, { t, on -> t.copy(streaming = on) }),
        Triple("Duelo de revisão", { it.duel }, { t, on -> t.copy(duel = on) }),
        Triple("Marcos da lista", { it.milestone }, { t, on -> t.copy(milestone = on) }),
        Triple("Aniversários de filmes e diretores", { it.birthday }, { t, on -> t.copy(birthday = on) })
    )

/**
 * Configurações de notificação. Ponto de entrada do pacote, registrado no `MainScreen`.
 *
 * @param context Lista, pessoa logada e navegação.
 */
@Composable
fun NotifySettingsEntry(context: ScreenContext) {
    val container = appContainer()
    val viewModel = viewModel(key = "notify-prefs") { NotifyPrefsViewModel(container) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val permission = rememberNotificationPermission()
    val others = context.list.memberUids.filter { it != context.uid }
    val otherName = if (others.size == 1) memberName(context.list, others.first()) else "o outro membro"

    ScreenColumn(title = "Notificações", onBack = context.back) {
        PermissionCard(permission)
        val prefs = state.prefs
        when {
            prefs != null -> PrefsSections(prefs, otherName, viewModel::update)

            state.failed ->
                Column {
                    EmptyState(
                        "Não deu para carregar",
                        "As preferências ficam na sua conta, no servidor. Confira a internet."
                    )
                    LombadaButton(
                        "Tentar de novo",
                        onClick = viewModel::load,
                        style = LombadaButtonStyle.Tonal,
                        modifier = Modifier.align(Alignment.CenterHorizontally)
                    )
                }

            else -> LoadingBlock()
        }
        SectionCard(title = "Testar", subtitle = "Chega em todos os celulares em que você entrou com esta conta.") {
            LombadaButton(
                "Enviar notificação de teste",
                onClick = viewModel::sendTest,
                style = LombadaButtonStyle.Tonal,
                busy = state.sendingTest,
                modifier = Modifier.fillMaxWidth()
            )
            if (!permission.granted) {
                Text(
                    "Sem a permissão, o aviso chega mas não aparece neste celular.",
                    style = MaterialTheme.typography.bodySmall,
                    color = LombadaColors.Paper3,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
        }
        Text(
            "As preferências ficam na sua conta e valem para todas as listas.",
            style = MaterialTheme.typography.bodySmall,
            color = LombadaColors.Paper3,
            modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 14.dp)
        )
    }
}

@Composable
private fun PermissionCard(permission: NotificationPermissionState) {
    SectionCard(title = null) {
        Row(verticalAlignment = Alignment.Top, modifier = Modifier.semantics(mergeDescendants = true) {}) {
            Icon(
                if (permission.granted) Icons.Filled.CheckCircle else Icons.Filled.NotificationsOff,
                contentDescription = null,
                tint = if (permission.granted) LombadaColors.Sticker else LombadaColors.Paper2
            )
            Column(modifier = Modifier.padding(start = 12.dp)) {
                Text(
                    if (permission.granted) {
                        "Notificações permitidas neste celular"
                    } else {
                        "Notificações desligadas neste celular"
                    },
                    style = MaterialTheme.typography.titleMedium
                )
                Text(
                    when {
                        permission.granted -> "Os avisos escolhidos abaixo aparecem aqui."

                        permission.canAsk ->
                            "Para os avisos aparecerem, o Android precisa da sua permissão. O app só pede aqui."

                        else ->
                            "O Android não mostra mais o pedido: ligue as notificações nas configurações."
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = LombadaColors.Paper2,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
        }
        if (!permission.granted) {
            LombadaButton(
                if (permission.canAsk) "Permitir notificações" else "Abrir configurações do Android",
                onClick = { if (permission.canAsk) permission.request() else permission.openSettings() },
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp)
            )
        }
    }
}

@Composable
private fun PrefsSections(prefs: NotifyPrefs, otherName: String, onChange: ((NotifyPrefs) -> NotifyPrefs) -> Unit) {
    val dailyOn = prefs.freq != 0
    SectionCard(
        title = "Notificação do dia",
        subtitle =
            "A pergunta do quiz chega às 9h, e às 21h vem um lembrete se você ainda não respondeu. " +
                "O horário abaixo vale para o assunto do dia, que é o mesmo para os membros da lista."
    ) {
        ChoiceChips(FREQUENCIES, prefs.freq, { value -> onChange { it.copy(freq = value) } })
        Text(
            "Horário",
            style = MaterialTheme.typography.titleSmall,
            modifier = Modifier.padding(top = 16.dp, bottom = 4.dp)
        )
        ChoiceChips(HOURS, prefs.hour, { value -> onChange { it.copy(hour = value) } }, enabled = dailyOn)
        Text(
            "O que pode vir",
            style = MaterialTheme.typography.titleSmall,
            modifier = Modifier.padding(top = 16.dp, bottom = 4.dp)
        )
        TYPES.forEach { (label, read, write) ->
            SwitchRow(label, null, read(prefs.types), enabled = dailyOn) { on ->
                onChange { it.copy(types = write(it.types, on)) }
            }
        }
    }
    SectionCard(title = "A lista de vocês") {
        SwitchRow(
            "Avisar quando $otherName mexer na lista",
            "Filmes novos e retirados, comentários, mudanças de ordem e o Quero ver",
            prefs.activity
        ) { on -> onChange { it.copy(activity = on) } }
        SwitchRow(
            "Agrupar em um aviso",
            "O aviso novo substitui o anterior na barra de notificações",
            prefs.activityGrouped,
            enabled = prefs.activity
        ) { on -> onChange { it.copy(activityGrouped = on) } }
    }
}

@Composable
private fun SwitchRow(
    label: String,
    detail: String?,
    checked: Boolean,
    enabled: Boolean = true,
    onChange: (Boolean) -> Unit
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .toggleable(value = checked, enabled = enabled, role = Role.Switch, onValueChange = onChange)
                .padding(vertical = 6.dp)
    ) {
        Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
            Text(
                label,
                style = MaterialTheme.typography.bodyLarge,
                color = if (enabled) LombadaColors.Paper else LombadaColors.Paper3
            )
            if (detail != null) {
                Text(detail, style = MaterialTheme.typography.bodySmall, color = LombadaColors.Paper3)
            }
        }
        Switch(
            checked = checked,
            onCheckedChange = null,
            enabled = enabled,
            colors =
                SwitchDefaults.colors(
                    checkedThumbColor = LombadaColors.StickerInk,
                    checkedTrackColor = LombadaColors.Sticker,
                    uncheckedThumbColor = LombadaColors.Paper3,
                    uncheckedTrackColor = LombadaColors.Ground,
                    uncheckedBorderColor = LombadaColors.Rule
                )
        )
    }
}
