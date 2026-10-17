package io.github.guilhermetelles.lombada.ui.lists

import android.content.ClipData
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.guilhermetelles.lombada.data.model.MovieList
import io.github.guilhermetelles.lombada.domain.Formatting
import io.github.guilhermetelles.lombada.domain.InviteCode
import io.github.guilhermetelles.lombada.ui.appContainer
import io.github.guilhermetelles.lombada.ui.components.LombadaButton
import io.github.guilhermetelles.lombada.ui.components.LombadaButtonStyle
import io.github.guilhermetelles.lombada.ui.components.LombadaTextField
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors
import java.time.ZoneId
import kotlinx.coroutines.launch

/**
 * "Suas listas": as listas visitadas, da mais recente para a mais antiga, com a ativa em destaque
 * e as ações dela (convidar, editar, sair, apagar), e os botões para entrar ou criar outra.
 *
 * @param uid Pessoa logada.
 * @param active Lista ativa.
 * @param lists Listas da pessoa, na ordem das recentes.
 * @param onPick Abre outra lista.
 * @param onJoin Abre "Usar código".
 * @param onCreate Abre "Criar lista".
 * @param onDismiss Fecha a folha.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ListsSheet(
    uid: String,
    active: MovieList,
    lists: List<MovieList>,
    onPick: (String) -> Unit,
    onJoin: () -> Unit,
    onCreate: () -> Unit,
    onDismiss: () -> Unit
) {
    val container = appContainer()
    val viewModel = viewModel(key = "lists-$uid") { ListsViewModel(container, uid) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()
    var confirm by remember { mutableStateOf<ListAction?>(null) }
    var editing by remember { mutableStateOf(false) }
    LaunchedEffect(lists.map { it.id }) { viewModel.loadCounts(lists) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
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
                "Suas listas",
                style = MaterialTheme.typography.headlineSmall.copy(fontSize = 24.sp),
                modifier = Modifier.padding(bottom = 14.dp).semantics { heading() }
            )
            lists.forEach { list ->
                val on = list.id == active.id
                ListRow(list, on, state.counts[list.id]) { if (on) onDismiss() else onPick(list.id) }
                if (on) {
                    ActiveListActions(
                        list = list,
                        uid = uid,
                        invite = state.invite?.takeIf { it.listId == list.id },
                        generating = state.generating,
                        busy = state.busyListId == list.id,
                        onGenerate = { viewModel.generateInvite(list.id) },
                        onCopy = { code ->
                            scope.launch {
                                clipboard.setClipEntry(
                                    ClipEntry(ClipData.newPlainText("Código da lista", InviteCode.format(code)))
                                )
                                container.snackbar.showSnackbar("Código copiado")
                            }
                        },
                        onEdit = { editing = true },
                        onLeave = { confirm = ListAction.Leave(list) },
                        onDelete = { confirm = ListAction.Delete(list) }
                    )
                }
            }
            HorizontalDivider(color = LombadaColors.Rule, modifier = Modifier.padding(top = 4.dp, bottom = 12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LombadaButton(
                    "Usar código",
                    onClick = onJoin,
                    style = LombadaButtonStyle.Tonal,
                    modifier = Modifier.weight(1f)
                )
                LombadaButton(
                    "Criar lista",
                    onClick = onCreate,
                    style = LombadaButtonStyle.Tonal,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }

    confirm?.let { action ->
        ConfirmDialog(
            action = action,
            onConfirm = {
                confirm = null
                when (action) {
                    is ListAction.Leave -> viewModel.leave(action.list)
                    is ListAction.Delete -> viewModel.delete(action.list)
                }
                onDismiss()
            },
            onDismiss = { confirm = null }
        )
    }
    if (editing) {
        EditListDialog(active, onSave = { name, description ->
            editing = false
            viewModel.rename(active, name, description)
        }, onDismiss = { editing = false })
    }
}

/** Ação destrutiva que pede confirmação. */
private sealed interface ListAction {
    val list: MovieList

    data class Leave(override val list: MovieList) : ListAction

    data class Delete(override val list: MovieList) : ListAction
}

@Composable
private fun ListRow(list: MovieList, active: Boolean, count: Long?, onClick: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 60.dp)
                .background(if (active) LombadaColors.Tonal else LombadaColors.Shelf, MaterialTheme.shapes.medium)
                .clickable(
                    role = Role.Button,
                    onClickLabel = if (active) "Fechar" else "Abrir ${list.name}",
                    onClick = onClick
                )
                .semantics { selected = active }
                .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(list.name, style = MaterialTheme.typography.titleMedium.copy(fontSize = 16.sp))
            if (count != null) {
                Text(
                    Formatting.count(count.toInt(), "filme", "filmes"),
                    style = MaterialTheme.typography.bodySmall,
                    color = LombadaColors.Paper2,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
        }
        if (active) Icon(Icons.Filled.Check, contentDescription = "Lista aberta", tint = LombadaColors.Sticker)
    }
}

@Composable
private fun ActiveListActions(
    list: MovieList,
    uid: String,
    invite: InviteCodeShown?,
    generating: Boolean,
    busy: Boolean,
    onGenerate: () -> Unit,
    onCopy: (String) -> Unit,
    onEdit: () -> Unit,
    onLeave: () -> Unit,
    onDelete: () -> Unit
) {
    Column(modifier = Modifier.padding(start = 12.dp, end = 4.dp, top = 6.dp, bottom = 10.dp)) {
        if (invite == null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Código para convidar",
                    style = MaterialTheme.typography.bodyMedium,
                    color = LombadaColors.Paper2,
                    modifier = Modifier.weight(1f)
                )
                LombadaButton("Gerar código", onClick = onGenerate, style = LombadaButtonStyle.Text, busy = generating)
            }
        } else {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    buildAnnotatedString {
                        append("Código para convidar: ")
                        withStyle(
                            SpanStyle(color = LombadaColors.Sticker, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                        ) {
                            append(InviteCode.format(invite.code))
                        }
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = LombadaColors.Paper2,
                    modifier = Modifier.weight(1f)
                )
                LombadaButton("Copiar", onClick = { onCopy(invite.code) }, style = LombadaButtonStyle.Text)
            }
            invite.expiresAt?.let {
                val date = Formatting.fullDate(it.atZone(ZoneId.systemDefault()).toLocalDate())
                Text(
                    "Vale até $date, para quantas pessoas entrarem.",
                    style = MaterialTheme.typography.bodySmall,
                    color = LombadaColors.Paper3
                )
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 4.dp)) {
            TextButton(onClick = onEdit, enabled = !busy) { Text("Editar nome", color = LombadaColors.Sticker) }
            TextButton(onClick = onLeave, enabled = !busy) { Text("Sair da lista", color = LombadaColors.Error) }
            if (list.ownerUid == uid) {
                TextButton(onClick = onDelete, enabled = !busy) { Text("Apagar", color = LombadaColors.Error) }
            }
        }
    }
}

@Composable
private fun ConfirmDialog(action: ListAction, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    val (title, body, confirm) =
        when (action) {
            is ListAction.Leave ->
                Triple(
                    "Sair de ${action.list.name}?",
                    "A lista some do seu celular. Para voltar, alguém da lista precisa mandar um código novo. " +
                        "Se você for a última pessoa, a lista e os filmes são apagados.",
                    "Sair"
                )

            is ListAction.Delete ->
                Triple(
                    "Apagar ${action.list.name}?",
                    "A lista e todos os filmes dela somem para todo mundo. Não dá para desfazer.",
                    "Apagar"
                )
        }
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = LombadaColors.Shelf,
        title = { Text(title) },
        text = { Text(body, color = LombadaColors.Paper2) },
        confirmButton = { TextButton(onClick = onConfirm) { Text(confirm, color = LombadaColors.Error) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar", color = LombadaColors.Sticker) } }
    )
}

@Composable
private fun EditListDialog(list: MovieList, onSave: (String, String) -> Unit, onDismiss: () -> Unit) {
    var name by remember { mutableStateOf(list.name) }
    var description by remember { mutableStateOf(list.description) }
    var error by remember { mutableStateOf<String?>(null) }
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = LombadaColors.Shelf,
        title = { Text("Editar lista") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                LombadaTextField(name, {
                    name = it.take(80)
                    error = null
                }, label = "Nome", error = error)
                LombadaTextField(description, {
                    description = it.take(280)
                }, label = "Descrição", optional = true, singleLine = false)
            }
        },
        confirmButton = {
            TextButton(onClick = {
                if (name.isBlank()) error = "Dê um nome para a lista." else onSave(name, description)
            }) {
                Text("Salvar", color = LombadaColors.Sticker)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar", color = LombadaColors.Sticker) } }
    )
}
