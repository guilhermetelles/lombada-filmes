/** Limites de uma execução da rotina diária. */
export type MaintenanceLimits = {
  movies: number;
  people: number;
};

/** Quantos documentos de um tipo a rotina atualizou e quantos falharam. */
export type RefreshCount = {
  refreshed: number;
  failed: number;
};

/** O que a rotina diária fez, devolvido pela rota e registrado no log da Vercel. */
export type MaintenanceReport = {
  movies: RefreshCount;
  people: RefreshCount;
  invitesDeleted: number;
};

/** O que a recarga do elenco encontrou e fez com um tipo de documento. */
export type BackfillCount = {
  missing: number; // documentos sem o dado novo
  updated: number; // gravados nesta execução (zero no ensaio)
  failed: number;
};

/** Resultado da recarga do elenco (passo 9): filmes sem `cast` e pessoas sem `acted`. */
export type BackfillReport = {
  movies: BackfillCount;
  people: BackfillCount;
};
