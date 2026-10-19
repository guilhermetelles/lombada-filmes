/** Limites de uma execução da rotina diária. */
export type MaintenanceLimits = {
  movies: number;
  bechdelMatches: number; // filmes ainda não casados que a rotina tenta casar
};

/** Quantos documentos a rotina atualizou e quantos falharam. */
export type RefreshCount = {
  refreshed: number;
  failed: number;
};

/** O que a rotina fez no Teste de Bechdel. */
export type BechdelCount = {
  updated: number; // casados com critérios ou duvidosa alterados pelo índice
  matched: number; // casados agora
  notFound: number; // procurados e fora do site
  failed: number; // não atualizados por falha do site
};

/** Documentos velhos apagados pela rotina diária. */
export type CleanupCount = {
  feed: number; // itens da Atividade com mais de 180 dias
  notifyLog: number; // registros de notificação com mais de 45 dias
  rateLimits: number; // contagens diárias de limite com mais de 45 dias
};

/** O que a rotina diária fez, devolvido pela rota e registrado no log da Vercel. */
export type MaintenanceReport = {
  movies: RefreshCount;
  bechdel: BechdelCount;
  invitesDeleted: number;
  deleted: CleanupCount;
};
