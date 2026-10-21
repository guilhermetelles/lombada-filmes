package io.github.guilhermetelles.lombada.data

import androidx.test.ext.junit.runners.AndroidJUnit4
import io.github.guilhermetelles.lombada.data.firestore.MovieRepository
import io.github.guilhermetelles.lombada.data.model.MovieTrailer
import io.github.guilhermetelles.lombada.support.Emulators
import java.time.LocalDate
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/** Leitura de `movies/{tmdbId}` como o backend grava, passando pelas regras de leitura. */
@RunWith(AndroidJUnit4::class)
class MovieRepositoryTest {
    private val movies = MovieRepository(Emulators.firestore)

    @Before
    fun clear() = runBlocking { Emulators.clearFirestore() }

    /**
     * Campos mínimos de um filme, mais os extras dados.
     *
     * @param extra Campos a mais, já no formato da API REST, começando com vírgula.
     * @return O conteúdo de `"fields"`.
     */
    private fun movieFields(extra: String = "") =
        """
        {
          "title":{"stringValue":"The Abyss"},
          "year":{"integerValue":"1989"},
          "directors":{"arrayValue":{"values":[]}},
          "genres":{"arrayValue":{"values":[]}},
          "synopsis":{"mapValue":{"fields":{"pt":{"nullValue":null},"en":{"nullValue":null}}}},
          "posterPath":{"nullValue":null},
          "ids":{"mapValue":{"fields":{"imdb":{"nullValue":null},"letterboxd":{"nullValue":null}}}},
          "ratings":{"mapValue":{"fields":{}}},
          "tmdbFetchedAt":{"timestampValue":"2026-10-21T10:00:00Z"}$extra
        }
        """.trimIndent()

    @Test
    fun leAImagemHorizontalEOTrailer() = runBlocking {
        Emulators.signIn("filme@teste.lombada")
        Emulators.seedDocument(
            "movies/2756",
            movieFields(
                """,
                "backdropPath":{"stringValue":"/mW6XzxelLY8T2oW2NjciG9LpZT5.jpg"},
                "trailer":{"mapValue":{"fields":{
                  "key":{"stringValue":"7cCVYAcIIAo"},
                  "name":{"stringValue":"4K Remastered Official Trailer"},
                  "lang":{"stringValue":"en"},
                  "published":{"stringValue":"2023-11-13"}
                }}}
                """.trimIndent()
            )
        )

        val movie = requireNotNull(movies.observe(2756).first())

        assertEquals("/mW6XzxelLY8T2oW2NjciG9LpZT5.jpg", movie.backdropPath)
        assertEquals(
            MovieTrailer("7cCVYAcIIAo", "4K Remastered Official Trailer", "en", LocalDate.of(2023, 11, 13)),
            movie.trailer
        )
    }

    @Test
    fun filmeAntigoOuSemTrailerFicaSemOsDois() = runBlocking {
        Emulators.signIn("filme@teste.lombada")
        Emulators.seedDocument("movies/2756", movieFields())
        Emulators.seedDocument("movies/2757", movieFields(""", "trailer":{"nullValue":null}"""))

        val old = requireNotNull(movies.observe(2756).first())
        val withoutTrailer = requireNotNull(movies.observe(2757).first())

        assertNull(old.backdropPath)
        assertNull(old.trailer)
        assertNull(withoutTrailer.trailer)
    }
}
