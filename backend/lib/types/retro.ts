/** Documento lists/{listId}/retros/{mês}: retrospectiva do mês, gravada no dia 1 do mês seguinte. */
export type Retro = {
  month: string; // AAAA-MM
  films: number;
  minutes: number;
  bestEntryId: string | null;
  worstEntryId: string | null;
  genres: [string, number][]; // gênero e quantos filmes, do mais visto para o menos
  text: string | null; // Gemini, a partir dos comentários do mês
  generatedAt: Date;
};
