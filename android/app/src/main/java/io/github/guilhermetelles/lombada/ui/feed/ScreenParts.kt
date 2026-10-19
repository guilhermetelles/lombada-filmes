package io.github.guilhermetelles.lombada.ui.feed

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import io.github.guilhermetelles.lombada.data.model.MemberProfile
import io.github.guilhermetelles.lombada.data.model.MovieList
import io.github.guilhermetelles.lombada.ui.components.initialsOf
import io.github.guilhermetelles.lombada.ui.theme.LombadaColors

/**
 * Esqueleto das telas por cima das abas (Atividade, quiz, detalhes da lista e as telas de
 * notificação): barra com voltar, título e ações, e o conteúdo rolando por baixo.
 *
 * @param title Título da barra.
 * @param onBack Voltar; null nas abas, que não têm.
 * @param actions Ícones à direita da barra.
 * @param content Conteúdo, numa coluna com rolagem.
 */
@Composable
fun ScreenColumn(
    title: String,
    onBack: (() -> Unit)?,
    actions: @Composable RowScope.() -> Unit = {},
    content: @Composable ColumnScope.() -> Unit
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(LombadaColors.Ground)
                .statusBarsPadding()
    ) {
        ScreenTopBar(title, onBack, actions)
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .then(if (onBack != null) Modifier.navigationBarsPadding() else Modifier)
                    .padding(bottom = 24.dp),
            content = content
        )
    }
}

/**
 * Barra de 56dp com voltar, título e ações.
 *
 * @param title Título.
 * @param onBack Voltar; null sem o botão.
 * @param actions Ícones à direita.
 */
@Composable
fun ScreenTopBar(title: String, onBack: (() -> Unit)?, actions: @Composable RowScope.() -> Unit = {}) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier =
            Modifier
                .fillMaxWidth()
                .height(56.dp)
                .padding(start = if (onBack == null) 20.dp else 4.dp, end = 4.dp)
    ) {
        if (onBack != null) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar") }
        }
        Text(
            title,
            style = MaterialTheme.typography.titleLarge.copy(fontSize = 18.sp),
            maxLines = 1,
            modifier =
                Modifier
                    .weight(1f)
                    .padding(start = if (onBack == null) 0.dp else 4.dp)
                    .semantics { heading() }
        )
        actions()
    }
}

/**
 * Seção em `--shelf` com raio 16, como as dos relatórios.
 *
 * @param title Título; null sem título.
 * @param modifier Modificador do Compose.
 * @param subtitle Linha explicativa embaixo do título.
 * @param content Conteúdo.
 */
@Composable
fun SectionCard(
    title: String?,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    Column(
        modifier =
            modifier
                .padding(start = 16.dp, end = 16.dp, top = 14.dp)
                .fillMaxWidth()
                .background(LombadaColors.Shelf, MaterialTheme.shapes.large)
                .padding(16.dp)
    ) {
        if (title != null) {
            Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.semantics { heading() })
        }
        if (subtitle != null) {
            Text(
                subtitle,
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp, lineHeight = 18.sp),
                color = LombadaColors.Paper3,
                modifier = Modifier.padding(top = 3.dp)
            )
        }
        if (title != null || subtitle != null) Box(Modifier.height(12.dp))
        content()
    }
}

/**
 * Tela vazia que explica o que vai aparecer, sem dados de exemplo.
 *
 * @param title Frase curta em destaque.
 * @param body Explicação.
 * @param modifier Modificador do Compose.
 * @param actionLabel Texto do botão abaixo da explicação; null não mostra botão.
 * @param onAction Ação do botão.
 */
@Composable
fun EmptyState(
    title: String,
    body: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier =
            modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp, vertical = 40.dp)
                .semantics(mergeDescendants = true) {}
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
        Text(
            body,
            style = MaterialTheme.typography.bodyMedium,
            color = LombadaColors.Paper2,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 6.dp)
        )
        if (actionLabel != null && onAction != null) {
            TextButton(onClick = onAction, modifier = Modifier.padding(top = 8.dp)) {
                Text(actionLabel, color = LombadaColors.Sticker)
            }
        }
    }
}

/** Indicador de carregamento centralizado. */
@Composable
fun LoadingBlock() {
    Box(
        Modifier
            .fillMaxWidth()
            .padding(48.dp),
        contentAlignment = Alignment.Center
    ) { CircularProgressIndicator(color = LombadaColors.Sticker) }
}

/**
 * Foto redonda de um membro; sem foto (ou enquanto carrega), as iniciais. Decorativa: o nome fica ao lado.
 *
 * @param name Nome, para as iniciais.
 * @param photoUrl Foto da conta Google.
 * @param size Diâmetro.
 */
@Composable
fun MemberAvatar(name: String, photoUrl: String?, size: Dp = 32.dp) {
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            Modifier
                .size(size)
                .clip(CircleShape)
                .background(LombadaColors.ShelfHigh)
                .clearAndSetSemantics {}
    ) {
        Text(
            initialsOf(name),
            style = MaterialTheme.typography.labelMedium.copy(fontSize = (size.value * 0.36f).sp),
            color = LombadaColors.Paper2
        )
        if (photoUrl != null) {
            AsyncImage(
                photoUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.size(size)
            )
        }
    }
}

/**
 * Nome de um membro da lista, de `memberProfiles`.
 *
 * @param list Lista.
 * @param uid Membro.
 * @return O nome; "Outro membro" enquanto o backend não sincronizou.
 */
fun memberName(list: MovieList, uid: String): String =
    list.memberProfiles[uid]?.name?.takeIf { it.isNotBlank() } ?: "Outro membro"

/**
 * Perfil de um membro, com nome de reserva.
 *
 * @param list Lista.
 * @param uid Membro.
 * @return Nome e foto.
 */
fun memberProfile(list: MovieList, uid: String): MemberProfile =
    MemberProfile(memberName(list, uid), list.memberProfiles[uid]?.photoUrl)

/**
 * Grupo de opções de escolha única (ou de filtro) em chips, com marca na escolhida.
 *
 * @param options Rótulos e valores.
 * @param selected Valor escolhido.
 * @param onSelect Escolhe um valor.
 * @param enabled Se aceita toque.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun <T> ChoiceChips(options: List<Pair<String, T>>, selected: T, onSelect: (T) -> Unit, enabled: Boolean = true) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEach { (label, value) ->
            val on = value == selected
            FilterChip(
                selected = on,
                onClick = { onSelect(value) },
                enabled = enabled,
                label = { Text(label) },
                leadingIcon = if (on) {
                    { Icon(Icons.Filled.Check, contentDescription = null, modifier = Modifier.size(18.dp)) }
                } else {
                    null
                },
                colors =
                    FilterChipDefaults.filterChipColors(
                        selectedContainerColor = LombadaColors.Tonal,
                        selectedLabelColor = LombadaColors.Paper,
                        selectedLeadingIconColor = LombadaColors.Sticker,
                        labelColor = LombadaColors.Paper2
                    )
            )
        }
    }
}
