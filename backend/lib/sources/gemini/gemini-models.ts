/** Versões fixas dos modelos do Gemini (nunca -latest, para o comportamento não mudar sozinho). */
export const GEMINI_MODELS = {
  /**
   * Interpretação do texto livre da busca. Em 2026-10-18 o gemini-3.5-flash-lite errou frases
   * simples (perdia "curto" e "anos 90" e listava todos os temas de uma vez); o 3.8 Flash acertou
   * todas, em 3 a 11 s. O limite de 30 por pessoa por dia segura o consumo.
   */
  interpret: 'gemini-3.8-flash',
  /** Textos: motivos das sugestões, retrospectiva, quiz (trecho, emojis, sinopse sem nomes). */
  text: 'gemini-3.8-flash',
} as const;
