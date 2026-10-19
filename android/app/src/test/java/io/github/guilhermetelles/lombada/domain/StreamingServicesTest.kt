package io.github.guilhermetelles.lombada.domain

import org.junit.Assert.assertEquals
import org.junit.Test

class StreamingServicesTest {
    @Test
    fun `canal da Amazon some quando o serviço base está na lista`() {
        assertEquals(
            listOf("Max", "Prime Video"),
            StreamingServices.unify(listOf("Max", "Max Amazon Channel", "Prime Video"))
        )
    }

    @Test
    fun `canal da Amazon fica quando é o único jeito de ver`() {
        assertEquals(listOf("MGM+ Amazon Channel"), StreamingServices.unify(listOf("MGM+ Amazon Channel")))
    }

    @Test
    fun `Paramount Plus e Paramount+ são o mesmo serviço`() {
        assertEquals(
            listOf("Paramount+", "Netflix"),
            StreamingServices.unify(
                listOf("Paramount+", "Paramount Plus", "Netflix", "Paramount Plus Amazon Channel", "Netflix")
            )
        )
        assertEquals(listOf("Paramount Plus"), StreamingServices.unify(listOf("Paramount Plus", "Paramount+")))
    }
}
