package io.github.guilhermetelles.lombada.domain

import io.github.guilhermetelles.lombada.data.model.MovieTrailer
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Test

class TrailerLinesTest {
    private val abyss = MovieTrailer("7cCVYAcIIAo", "4K Remastered Official Trailer", "en", LocalDate.of(2023, 11, 13))

    @Test
    fun `junta o site, o idioma e a data`() {
        assertEquals("YouTube · em inglês · 13/11/2023", TrailerLines.meta(abyss))
        assertEquals("YouTube · em português", TrailerLines.meta(abyss.copy(lang = "pt", published = null)))
        assertEquals("YouTube · 13/11/2023", TrailerLines.meta(abyss.copy(lang = "fr")))
    }

    @Test
    fun `o rótulo de acessibilidade traz o nome do vídeo`() {
        assertEquals(
            "Ver o trailer no YouTube: 4K Remastered Official Trailer (abre fora do app)",
            TrailerLines.accessibilityLabel(abyss)
        )
        assertEquals(
            "Ver o trailer no YouTube: trailer do filme (abre fora do app)",
            TrailerLines.accessibilityLabel(abyss.copy(name = ""))
        )
    }
}
