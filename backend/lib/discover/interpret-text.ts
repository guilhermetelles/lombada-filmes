import { InterpretReplySchema } from '../schemas/discover.js';
import { GEMINI_MODELS } from '../sources/gemini/gemini-models.js';
import type { Filters, InterpretReply } from '../types/discover.js';
import type { GeminiClient } from '../types/sources.js';
import type { UsageRecorder } from '../types/usage.js';
import { genreIdByName, STREAMING_SERVICES, streamingServiceByName, TMDB_GENRES } from './discover-vocabulary.js';
import { filtersFromWords } from './filters-from-words.js';

/** Instrução de sistema: o vocabulário fechado dos filtros e como explicar o que foi entendido. */
const SYSTEM_INSTRUCTION = `Você transforma um pedido em português sobre que filme ver em filtros de uma busca de filmes.
Responda só com o JSON pedido. Use apenas os valores listados.
Regras:
1. Cada valor precisa de uma palavra do pedido que o justifique. Na dúvida, deixe de fora.
2. Nunca liste vários temas ou gêneros "para cobrir tudo": em geral o pedido pede 0, 1 ou 2.
3. Palavras sobre tamanho valem como duração: "curto", "curtinho", "rápido" = "ate90"; "longo", "épico" = "mais120".
4. "trash", "tosco", "ruim de propósito" = humor "ruim-divertido"; só use o tema "trash" se o pedido falar de terror.
5. Décadas: "anos 80" = "1980", "anos 90" = "1990", "anos 2000" = "2000"; "antigo", "clássico antigo" ou antes de 1970 = "antes70".
6. Um serviço citado ("na Netflix", "no Prime") vai em svc. Tudo o que estiver na explanation tem que estar em filters.

- mood (humor): "leve" (comédia, animação, família, romance, sem terror), "tenso" (suspense, terror, mistério),
  "ruim-divertido" (trash, tosco, tão ruim que é bom, paródia), "chorar" (drama triste, emocionante), "cult".
- dur (duração): "ate90" (curto, até 90 minutos), "90a120" (de 90 a 120 minutos), "mais120" (longo, mais de 2 horas).
- dec (década de lançamento): "antes70", "1970", "1980", "1990", "2000", "2010", "2020".
- genre (gênero, nomes exatos): ${Object.values(TMDB_GENRES)
  .filter((genre) => genre !== 'Cinema TV')
  .map((genre) => `"${genre}"`)
  .join(', ')}. "Suspense" é "Thriller".
- theme (tema): "lgbt" (personagens ou casais LGBT+), "fatos" (baseado em fatos reais, biografia), "trash" (terror trash, B),
  "tempo" (viagem no tempo), "golpes" (assaltos, golpes), "espaco" (espaço, astronautas), "zumbis-vampiros",
  "halloween", "serial-killer", "livro" (baseado em livro).
- svc (streaming no Brasil, nomes exatos): ${STREAMING_SERVICES.map((service) => `"${service.name}"`).join(', ')}.
- fit: true só quando o pedido diz que o filme tem que combinar com o gosto do casal ("a nossa cara", "combina com a gente").

keywords: até 5 termos que o pedido traz e os filtros acima não cobrem (assunto, lugar, criatura, situação, tipo de
personagem), cada um como a palavra-chave em inglês que o TMDb usaria ("shark", "time loop", "heist", "small town",
"road trip", "boxing") e o rótulo curto em português para mostrar ("tubarão", "loop temporal"). Não repita como termo
o que já entrou em genre, theme ou mood, nem palavras genéricas ("movie", "film", "good", "funny").

explanation: uma frase curta em português, dirigida a quem pediu, dizendo o que você entendeu em termos dos filtros e dos termos
(ex. de forma: "Comédias de até 90 minutos dos anos 1990."). Se nada do pedido couber nos filtros, devolva filters vazio
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
 * no lugar do que o modelo devolveu nesses grupos.
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
    system: SYSTEM_INSTRUCTION,
    prompt: text,
    schema: InterpretReplySchema,
    usage,
    timeoutMs: INTERPRET_MODEL_TIMEOUT_MS,
    budgetMs: INTERPRET_BUDGET_MS,
  });
  return {
    filters: cleanFilters({ ...reply.filters, ...filtersFromWords(text) }),
    explanation: reply.explanation.trim(),
    keywords: reply.keywords.filter((keyword) => keyword.term.trim() !== ''),
  };
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
