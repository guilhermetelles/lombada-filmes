/**
 * Versões fixas dos modelos do Gemini (nunca -latest, para o comportamento não mudar sozinho), em
 * ordem de preferência. No plano grátis cada modelo tem a própria cota diária (o 3.8 Flash dá só 20
 * pedidos por dia): quando um responde 429, o cliente tenta o próximo da lista. Em 2026-10-18 só
 * estes respondiam pela chave do projeto; o 3.5 e o 3.6 Flash estavam sem cota grátis, e os 2.5,
 * desativados para contas novas.
 */
export const GEMINI_MODELS = {
  /**
   * Interpretação do texto livre da busca. Em 2026-10-18 o gemini-3.5-flash-lite errou frases
   * simples (perdia "curto" e "anos 90" e listava todos os temas de uma vez); o 3.8 Flash acertou
   * todas, em 3 a 11 s. Os outros ficam de reserva para a busca não parar quando a cota acaba.
   */
  interpret: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
  /**
   * Textos: motivos das sugestões, retrospectiva, quiz (trecho, emojis, sinopse sem nomes). Começa
   * pelo 3.7 Flash para deixar a cota do 3.8 para a busca.
   */
  text: ['gemini-3.7-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'],
} as const;
