/** Documento users/{uid}; o backend só lê (a própria pessoa grava). */
export type UserDoc = {
  feedSeenAt?: Record<string, Date> | undefined; // por listId: até quando a Atividade foi vista
};
