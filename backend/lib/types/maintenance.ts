/** Limites de uma execução da rotina diária. */
export type MaintenanceLimits = {
  movies: number;
  people: number;
};

/** O que a rotina diária fez, devolvido pela rota e registrado no log da Vercel. */
export type MaintenanceReport = {
  movies: { refreshed: number; failed: number };
  people: { refreshed: number; failed: number };
  invitesDeleted: number;
};
