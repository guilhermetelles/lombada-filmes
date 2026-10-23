import { InterpretReplySchema } from '../schemas/discover.js';
import { GEMINI_MODELS } from '../sources/gemini/gemini-models.js';
import type { Filters, InterpretReply } from '../types/discover.js';
import type { GeminiClient } from '../types/sources.js';
import type { UsageRecorder } from '../types/usage.js';
import { genreIdByName, STREAMING_SERVICES, streamingServiceByName, TMDB_GENRES } from './discover-vocabulary.js';
import { filtersFromWords, mentionsReleaseEra } from './filters-from-words.js';

/** Instrução de sistema: o vocabulário fechado dos filtros e como explicar o que foi entendido. */
const SYSTEM_INSTRUCTION = `Você transforma um pedido em português sobre que filme ver em filtros de uma busca de filmes.
Responda só com o JSON pedido. Use apenas os valores listados.
Regras:
1. Cada valor precisa de uma palavra do pedido que o justifique. Na dúvida, deixe de fora: um filtro a mais tira da busca
   filmes que a pessoa queria.
2. O assunto do pedido (o que acontece no filme, onde, quando se passa a história, quem são os personagens) vai em
   keywords, não em theme. Ex.: "romance futuro" = genre Romance + keywords "future"; "filme de máfia" = keywords "mafia";
   "comédia sobre casamento" = genre Comédia + keywords "wedding".
3. theme só quando o pedido nomeia o tema da lista abaixo ("viagem no tempo", "astronautas", "baseado em livro"). Futuro,
   passado, robôs ou tecnologia não são "tempo" nem "espaco".
4. mood só quando o pedido descreve o clima ("leve", "tenso", "pra chorar", "tosco", "cult"). Um gênero citado não vira
   mood: "romance" ou "comédia" sozinhos não são "leve", "terror" sozinho não é "tenso".
5. dec só quando o pedido fala da época de lançamento: "anos 80" = "1980", "anos 90" = "1990", "anos 2000" = "2000";
   "antigo", "clássico antigo" ou antes de 1970 = "antes70". "Futuro" ou "passado" falam da história, não do lançamento.
6. Palavras sobre tamanho valem como duração: "curto", "curtinho", "rápido" = "ate90"; "longo", "épico" = "mais120".
7. "trash", "tosco", "ruim de propósito" = humor "ruim-divertido"; só use o tema "trash" se o pedido falar de terror.
8. Nunca liste vários temas ou gêneros "para cobrir tudo": em geral o pedido pede 0, 1 ou 2.
9. Um serviço citado ("na Netflix", "no Prime") vai em svc. Tudo o que estiver na explanation tem que estar em filters
   ou em keywords.

- mood (humor): "leve" (clima leve, divertido, para relaxar), "tenso" (clima tenso, de suspense, de dar medo),
  "ruim-divertido" (trash, tosco, tão ruim que é bom), "chorar" (para chorar, triste, emocionante), "cult".
- dur (duração): "ate90" (curto, até 90 minutos), "90a120" (de 90 a 120 minutos), "mais120" (longo, mais de 2 horas).
- dec (década de lançamento): "antes70", "1970", "1980", "1990", "2000", "2010", "2020".
- genre (gênero, nomes exatos): ${Object.values(TMDB_GENRES)
  .filter((genre) => genre !== 'Cinema TV')
  .map((genre) => `"${genre}"`)
  .join(', ')}. "Suspense" é "Thriller".
- theme (tema): "lgbt" (personagens ou casais LGBT+), "fatos" (baseado em fatos reais, biografia), "trash" (terror trash, B),
  "tempo" (viagem no tempo), "golpes" (assaltos, golpes), "espaco" (espaço sideral, astronautas), "zumbis-vampiros",
  "halloween", "serial-killer", "livro" (baseado em livro).
- svc (streaming no Brasil, nomes exatos): ${STREAMING_SERVICES.map((service) => `"${service.name}"`).join(', ')}.
- fit: true só quando o pedido diz que o filme tem que combinar com o gosto do casal ("a nossa cara", "combina com a gente").

keywords: até 5 termos do assunto do pedido (regra 2: tema da história, época em que se passa, lugar, criatura,
situação, tipo de personagem), cada um como a palavra-chave em inglês que o TMDb usaria ("future", "artificial
intelligence", "wedding", "mafia", "haunted house", "grief", "shark", "time loop", "small town") e o rótulo curto em
português para mostrar ("futuro", "casamento", "tubarão"). Não repita como termo o que já entrou em genre, theme ou mood,
nem palavras genéricas ("movie", "film", "good", "funny").

explanation: uma frase curta em português, dirigida a quem pediu, dizendo o que você entendeu em termos dos filtros e dos termos
(ex. de forma: "Comédias de até 90 minutos dos anos 1990."), em palavras comuns: sem citar os valores internos
("ruim-divertido", "ate90", "antes70") nem estas regras. Se nada do pedido couber nos filtros, devolva filters vazio
e diga isso na explanation.`;

/**
 * Prazo de cada modelo na busca: o 3.8 Flash costuma responder em 3 a 11 s, e um modelo que passa
 * disso em geral está sobrecarregado (em 2026-10-23 o 3.7 Flash ficou 30 s sem responder).
 */
export const INTERPRET_MODEL_TIMEOUT_MS = 10_000;

/**
 * Prazo do Gemini na busca, somando os modelos tentados. Cabe nos 30 s que o app espera pela
 * resposta, com folga para o limite diário e as palavras-chave do TMDb.
 */
export const INTERPRET_BUDGET_MS = 22_000;

/**
 * Pede ao Gemini os filtros da busca avançada para um texto livre e limpa a resposta: gêneros e
 * serviços ficam só se forem conhecidos (com o nome do TMDb), sem repetidos, e grupos vazios saem.
 * Duração e década ditas com as palavras fixas da instrução ("curto", "anos 90") valem pelo texto,
 * no lugar do que o modelo devolveu nesses grupos, e a década sai se o pedido não fala de época.
 *
 * @param gemini - Cliente do Gemini.
 * @param text - Frase digitada (2 a 200 caracteres, já validada).
 * @param usage - Medidor de consumo, para contar por modelo e pular os que estão sem cota.
 * @returns Filtros, a explicação curta e os termos para palavras-chave (ainda sem id).
 * @throws {SourceUnavailableError} Se o Gemini falhar, não tiver chave ou responder fora do formato.
 */
async function interpretText(gemini: GeminiClient, text: string, usage?: UsageRecorder): Promise<InterpretReply> {
  const reply = await gemini.generateJson({
    model: GEMINI_MODELS.interpret,
    purpose: 'search',
    system: SYSTEM_INSTRUCTION,
    prompt: text,
    schema: InterpretReplySchema,
    usage,
    timeoutMs: INTERPRET_MODEL_TIMEOUT_MS,
    budgetMs: INTERPRET_BUDGET_MS,
  });
  return {
    filters: cleanFilters(withWords(reply.filters, text)),
    explanation: reply.explanation.trim(),
    keywords: reply.keywords.filter((keyword) => keyword.term.trim() !== ''),
  };
}

/**
 * Junta aos filtros do modelo o que as palavras fixas do pedido dizem: duração e década ditas com
 * elas valem pelo texto, e a década some quando o pedido não fala de época nenhuma.
 *
 * @param filters - Filtros como o modelo devolveu.
 * @param text - Frase digitada.
 * @returns Os filtros com duração e década conferidas no texto.
 */
function withWords(filters: Filters, text: string): Filters {
  const words = filtersFromWords(text);
  const merged: Filters = { ...filters, ...words };
  if (!words.dec && !mentionsReleaseEra(text)) delete merged.dec;
  return merged;
}

/**
 * Deixa nos filtros só valores que a busca entende, sem repetidos e sem grupos vazios.
 *
 * @param filters - Filtros como o Gemini devolveu (já no vocabulário fechado, menos gênero e serviço).
 * @returns Filtros limpos.
 */
function cleanFilters(filters: Filters): Filters {
  const genre = unique(
    (filters.genre ?? []).flatMap((name) => {
      const id = genreIdByName(name);
      return id === undefined ? [] : [TMDB_GENRES[id] ?? name];
    }),
  );
  const svc = unique((filters.svc ?? []).flatMap((name) => streamingServiceByName(name)?.name ?? []));
  const cleaned: Filters = {};
  const mood = unique(filters.mood ?? []);
  const dur = unique(filters.dur ?? []);
  const dec = unique(filters.dec ?? []);
  const theme = unique(filters.theme ?? []);
  if (mood.length > 0) cleaned.mood = mood;
  if (dur.length > 0) cleaned.dur = dur;
  if (dec.length > 0) cleaned.dec = dec;
  if (genre.length > 0) cleaned.genre = genre;
  if (theme.length > 0) cleaned.theme = theme;
  if (svc.length > 0) cleaned.svc = svc;
  if (filters.fit === true) cleaned.fit = true;
  return cleaned;
}

/**
 * Tira os repetidos mantendo a ordem.
 *
 * @param values - Valores.
 * @returns Os valores sem repetição.
 */
function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export { interpretText };
