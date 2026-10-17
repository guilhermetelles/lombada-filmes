package io.github.guilhermetelles.lombada.ui.onboarding

import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.input.OffsetMapping
import androidx.compose.ui.text.input.TransformedText
import androidx.compose.ui.text.input.VisualTransformation
import io.github.guilhermetelles.lombada.domain.InviteCode

/**
 * Mostra o código como `ABC-123` sem pôr o traço no texto do campo, para o cursor não pular
 * quando o traço aparece.
 */
object InviteCodeTransformation : VisualTransformation {
    override fun filter(text: AnnotatedString): TransformedText {
        val raw = text.text
        val mapping =
            object : OffsetMapping {
                override fun originalToTransformed(offset: Int): Int = if (offset <= 3 ||
                    raw.length <= 3
                ) {
                    offset
                } else {
                    offset + 1
                }

                override fun transformedToOriginal(offset: Int): Int = (
                    if (offset <=
                        3
                    ) {
                        offset
                    } else {
                        offset - 1
                    }
                    ).coerceAtMost(raw.length)
            }
        return TransformedText(AnnotatedString(InviteCode.format(raw)), mapping)
    }
}
