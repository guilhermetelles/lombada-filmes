package io.github.guilhermetelles.lombada.ui.main

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import io.github.guilhermetelles.lombada.data.model.MemberProfile
import io.github.guilhermetelles.lombada.ui.components.initialsOf
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

private val AVATAR_SIZE = 30.dp
private val AVATAR_OVERLAP = 8.dp

/**
 * Ações do topo da Lista, antes do menu ⋮: os avatares dos membros e o sino da Atividade.
 *
 * @param unseenCount Itens da Atividade ainda não vistos; 0 esconde o contador.
 * @param members Nome e foto dos membros, na ordem de `memberUids`; vazio esconde os avatares.
 * @param onOpenFeed Abre a Atividade.
 * @param onOpenListInfo Abre os detalhes da lista.
 */
@Composable
fun ListTopActions(unseenCount: Int, members: List<MemberProfile>, onOpenFeed: () -> Unit, onOpenListInfo: () -> Unit) {
    if (members.isNotEmpty()) MemberAvatars(members, onOpenListInfo)
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

/**
 * Avatares sobrepostos, um botão só que abre os detalhes da lista.
 *
 * @param members Membros com nome.
 * @param onClick Abre os detalhes da lista.
 */
@Composable
private fun MemberAvatars(members: List<MemberProfile>, onClick: () -> Unit) {
    val description = "Membros: ${members.joinToString(" e ") { it.name }}. Abrir os detalhes da lista"
    Row(
        verticalAlignment = Alignment.CenterVertically,
        // Espaço negativo: cada avatar cobre um pedaço do anterior.
        horizontalArrangement = Arrangement.spacedBy(-AVATAR_OVERLAP),
        modifier =
            Modifier
                .clip(CircleShape)
                .clickable(onClick = onClick)
                .padding(horizontal = 6.dp, vertical = 9.dp)
                .clearAndSetSemantics {
                    contentDescription = description
                    role = Role.Button
                }
    ) {
        members.forEach { Avatar(it) }
    }
}

/**
 * Foto redonda do membro; sem foto (ou enquanto carrega), as iniciais.
 *
 * @param member Membro.
 * @param modifier Modificador do Compose.
 */
@Composable
private fun Avatar(member: MemberProfile, modifier: Modifier = Modifier) {
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            modifier
                .size(AVATAR_SIZE)
                .border(2.dp, LombadaColors.Ground, CircleShape)
                .padding(2.dp)
                .clip(CircleShape)
                .background(LombadaColors.ShelfHigh)
    ) {
        Text(
            initialsOf(member.name),
            style = MaterialTheme.typography.labelMedium.copy(fontSize = 11.sp),
            color = LombadaColors.Paper2
        )
        if (member.photoUrl != null) {
            AsyncImage(
                member.photoUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.size(AVATAR_SIZE)
            )
        }
    }
}
