package io.github.guilhermetelles.lombada.ui.main

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/**
 * Ações do topo da Lista, antes do menu ⋮: os avatares dos membros e o sino da Atividade.
 *
 * @param unseenCount Itens da Atividade ainda não vistos; 0 esconde o contador.
 * @param onOpenFeed Abre a Atividade.
 * @param members Avatares dos membros, que abrem os detalhes da lista.
 */
@Composable
fun ListTopActions(unseenCount: Int, onOpenFeed: () -> Unit, members: @Composable () -> Unit = {}) {
    members()
    val label = when (unseenCount) {
        0 -> "Atividade"
        1 -> "Atividade, 1 novidade"
        else -> "Atividade, $unseenCount novidades"
    }
    IconButton(onClick = onOpenFeed) {
        BadgedBox(
            badge = {
                if (unseenCount > 0) {
                    Badge(containerColor = LombadaColors.Sticker, contentColor = LombadaColors.StickerInk) {
                        Text(if (unseenCount > 99) "99+" else unseenCount.toString())
                    }
                }
            }
        ) { Icon(Icons.Outlined.Notifications, contentDescription = label) }
    }
}
