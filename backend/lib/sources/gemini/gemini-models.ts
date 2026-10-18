/** Versões fixas dos modelos do Gemini (nunca -latest, para o comportamento não mudar sozinho). */
export const GEMINI_MODELS = {
  /** Interpretação do texto livre da busca: rápida e barata. */
  interpret: 'gemini-3.5-flash-lite',
  /** Textos: motivos das sugestões, retrospectiva, quiz (trecho, emojis, sinopse sem nomes). */
  text: 'gemini-3.8-flash',
} as const;
