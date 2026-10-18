package io.github.guilhermetelles.lombada.ui.main

import io.github.guilhermetelles.lombada.data.model.MovieList
import io.github.guilhermetelles.lombada.ui.list.ListViewModel

/**
 * O que toda tela de entrada recebe do [MainScreen], para não precisar mexer nele a cada
 * navegação nova.
 *
 * @property list Lista ativa.
 * @property uid Pessoa logada.
 * @property listViewModel Estado da lista (ranking, posições) e as folhas de registrar e editar.
 * @property navigate Abre qualquer rota de `Routes.kt`; as abas trocam de aba em vez de empilhar.
 * @property back Volta uma tela.
 */
class ScreenContext(
    val list: MovieList,
    val uid: String,
    val listViewModel: ListViewModel,
    val navigate: (Any) -> Unit,
    val back: () -> Unit
)
