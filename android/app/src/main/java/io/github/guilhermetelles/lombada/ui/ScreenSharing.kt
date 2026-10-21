package io.github.guilhermetelles.lombada.ui

import kotlinx.coroutines.flow.SharingStarted

/**
 * Até quando o estado de uma tela (o `stateIn` dos ViewModels) continua ouvindo o banco sem ninguém
 * olhando: 30 minutos. Ao trocar de app (ou abrir o Letterboxd) e voltar nesse prazo, nada recomeça,
 * então a tela não pisca vazia nem perde a rolagem. Com 5 segundos, a volta refazia os fluxos, que
 * começam com valores provisórios (carregando, vazio).
 */
val SCREEN_SHARING: SharingStarted = SharingStarted.WhileSubscribed(stopTimeoutMillis = 30 * 60 * 1_000L)
