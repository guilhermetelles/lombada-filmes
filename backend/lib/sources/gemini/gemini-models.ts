/**
 * Versões fixas dos modelos de texto (nunca -latest, para o comportamento não mudar sozinho), em
 * ordem de preferência: os do Gemini e, na busca, também os da Groq (modelProvider diz quem
 * atende). No plano grátis cada modelo tem a própria cota diária (o 3.8 Flash dá só 20 pedidos por
 * dia): quando um responde 429, o cliente tenta o próximo da lista. Em 2026-10-18 só
 * estes respondiam pela chave do projeto; o 3.5 e o 3.6 Flash estavam sem cota grátis, e os 2.5,
 * desativados para contas novas.
 */
export const GEMINI_MODELS = {
  /**
   * Interpretação do texto livre da busca. Em 2026-10-18 o gemini-3.5-flash-lite errou frases
   * simples (perdia "curto" e "anos 90" e listava todos os temas de uma vez); o 3.8 Flash acertou
   * todas, em 3 a 11 s. Em 2026-10-23, com 12 frases de teste, o 3.8 não respondeu nenhuma (503,
   * tempo limite e cota), o 3.5 Flash Lite acertou 11 de 14 respostas e o 3.1 Flash Lite 8 de 13; o
   * 3.7 Flash, que respondia 503 desde o dia 19, passou a ficar 30 s sem responder e foi para o fim.
   * As palavras de duração e década que os Lite perdem são lidas também no código (interpret-text).
   * Na mesma data, com 20 frases, os modelos da Groq acertaram quase todas em cerca de 1 s (Qwen 3.8
   * 27B 20/20, gpt-oss-120b 19/20, contra 14/20 do 3.5 Flash Lite sem a leitura das palavras) e vão
   * primeiro. Cada modelo da Groq tem a própria cota grátis (8 mil tokens por minuto, 1.000 pedidos
   * por dia); uma busca gasta cerca de 1.300 tokens.
   */
  interpret: [
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-120b',
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.7-flash',
  ],
  /**
   * Textos: motivos das sugestões, retrospectiva, quiz (trecho, emojis, sinopse sem nomes). Começa
   * pelo 3.5 Flash Lite: de 19 a 21/10/2026 o 3.7 Flash respondeu 503 em todos os pedidos, e cada um
   * custava uma chamada e a espera antes do modelo que respondia. O 3.8 fica por último, para deixar
   * a cota dele para a busca.
   */
  text: ['gemini-3.5-flash-lite', 'gemini-3.7-flash', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'],
} as const;

/** Quem atende cada modelo: os da Groq têm o dono no nome (`qwen/…`, `openai/…`); os do Gemini, não. */
export type ModelProvider = 'gemini' | 'groq';

/**
 * Diz qual API atende um modelo da lista.
 *
 * @param model - Versão do modelo.
 * @returns `gemini` para `gemini-…`; `groq` para os outros.
 */
export function modelProvider(model: string): ModelProvider {
  return model.startsWith('gemini-') ? 'gemini' : 'groq';
}
