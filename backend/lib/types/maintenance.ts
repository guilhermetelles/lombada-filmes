/** Limites de uma execução da rotina diária. */
export type MaintenanceLimits = {
  movies: number;
};

/** Quantos documentos a rotina atualizou e quantos falharam. */
export type RefreshCount = {
  refreshed: number;
  failed: number;
};

/** O que a rotina diária fez, devolvido pela rota e registrado no log da Vercel. */
export type MaintenanceReport = {
  movies: RefreshCount;
  invitesDeleted: number;
};
