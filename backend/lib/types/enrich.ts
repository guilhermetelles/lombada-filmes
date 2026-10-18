import type { Dependencies } from './dependencies.js';
import type { Movie } from './movie.js';
import type { UsageRecorder } from './usage.js';

/** Rotina enrich (api/cron/enrich): campos extras de movies/, onde assistir da fila e prêmios de pessoas. */

/** Etapas da rotina, na ordem em que rodam; `done` marca que o dia terminou. */
export type EnrichPhase = 'providers' | 'movies' | 'people' | 'done';

/**
 * Documento jobs/enrich (só o backend lê e grava): onde a rotina parou, para a próxima execução do
 * mesmo dia continuar dali. Num dia novo (fuso de Brasília), a rotina recomeça pela primeira etapa.
 */
export type EnrichCursor = {
  day: string; // AAAA-MM-DD em Brasília
  phase: EnrichPhase;
  after: number | null; // último id (filme ou pessoa) tratado na etapa; null no começo da etapa
  updatedAt: Date;
};

/** Quantos itens uma etapa atualizou e quantos falharam. */
export type EnrichCount = {
  updated: number;
  failed: number;
};

/** O que a rotina fez, devolvido pela rota e registrado no log da Vercel. */
export type EnrichReport = {
  day: string;
  resumedFrom: { phase: EnrichPhase; after: number | null } | null; // null quando começou do zero
  providers: EnrichCount; // onde assistir dos filmes da fila
  movies: EnrichCount; // campos extras e prêmios dos filmes das listas e da fila
  people: EnrichCount; // prêmios das pessoas recorrentes
  finished: boolean; // false quando parou pelo tempo ou pela cota da OMDb, com o cursor gravado
};

/** Limites de uma execução; os testes passam valores menores. */
export type EnrichLimits = {
  budgetMs: number; // tempo máximo antes de parar com o cursor (a função tem 300 s)
  batchSize: number; // filmes ou pessoas por lote (uma consulta ao Wikidata por lote)
  omdbCalls: number; // pedidos à OMDb por execução
};

/** Diz se o tempo da execução acabou. */
export type Budget = { expired(): boolean };

/** Até onde uma etapa chegou. */
export type PhaseProgress = {
  completed: boolean; // a etapa tratou todos os ids
  last: number | null; // último id tratado (para o cursor); null se nenhum
};

/** O que as etapas da rotina compartilham numa execução. */
export type EnrichContext = {
  dependencies: Dependencies;
  usage: UsageRecorder;
  now: Date; // início da execução: data gravada em tudo o que for buscado
  limits: EnrichLimits;
  budget: Budget;
  movies: Map<number, Movie>; // filmes das listas e da fila, atualizados à medida que a rotina grava
  omdbCallsLeft: number; // cota da OMDb que ainda resta nesta execução
};
