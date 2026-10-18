import type { RecsModel } from '../types/recs.js';
import { TMDB_GENRES } from './discover-vocabulary.js';
import type { CandidateExtras, DiscoverCandidate } from './tmdb-discover-client.js';

/** Compatibilidade de um filme com a lista e a frase curta que a justifica. */
export type Compat = { score: number; reason: string };

/**
 * Variáveis de um filme que o /discover já traz (e, nos 10 primeiros, as palavras-chave), nos nomes
 * que o modelo de recs/current usa nos pesos:
 * - `genre:<nome em pt-BR>` = 1 (ex.: `genre:Comédia`);
 * - `decade:<ano inicial>` = 1 (ex.: `decade:1990`);
 * - `vote` = nota do TMDb / 10;
 * - `votesLog` = log10(1 + votos) / 5, até 1;
 * - `popularityLog` = log10(1 + popularidade) / 3, até 1;
 * - `keyword:<nome em inglês>` = 1 (ex.: `keyword:time travel`), só quando há palavras-chave.
 * Variáveis que o modelo não conhece não contam.
 *
 * @param candidate - Filme do /discover.
 * @param extras - Detalhes do filme, quando buscados.
 * @returns Valor de cada variável.
 */
export function candidateFeatures(candidate: DiscoverCandidate, extras?: CandidateExtras): Record<string, number> {
  const features: Record<string, number> = {};
  for (const genre of candidateGenres(candidate)) features[`genre:${genre}`] = 1;
  if (candidate.year !== null) features[`decade:${Math.floor(candidate.year / 10) * 10}`] = 1;
  if (candidate.vote !== null) features.vote = candidate.vote / 10;
  features.votesLog = Math.min(1, Math.log10(1 + candidate.votes) / 5);
  features.popularityLog = Math.min(1, Math.log10(1 + candidate.popularity) / 3);
  for (const keyword of extras?.keywords ?? []) features[`keyword:${keyword}`] = 1;
  return features;
}

/**
 * Nomes em pt-BR dos gêneros de um filme do /discover (só os conhecidos).
 *
 * @param candidate - Filme do /discover.
 * @returns Os gêneros, na ordem do TMDb.
 */
export function candidateGenres(candidate: DiscoverCandidate): string[] {
  return candidate.genreIds.flatMap((id) => TMDB_GENRES[id] ?? []);
}

/**
 * Pontua um filme com o modelo da lista (regressão logística de recs/current): 100 × sigmoide do
 * viés mais a soma dos pesos pelas variáveis. O motivo cita as variáveis que mais pesaram a favor.
 *
 * @param model - Viés e pesos do modelo.
 * @param features - Variáveis do filme (candidateFeatures).
 * @returns Nota de 0 a 100 e o motivo.
 */
export function scoreWithModel(model: RecsModel, features: Record<string, number>): Compat {
  let logit = model.bias;
  const contributions: { feature: string; value: number }[] = [];
  for (const [feature, value] of Object.entries(features)) {
    const weight = model.weights[feature];
    if (weight === undefined) continue;
    logit += weight * value;
    contributions.push({ feature, value: weight * value });
  }
  const score = Math.round(100 / (1 + Math.exp(-logit)));

  const labelOf = (feature: string) => featureLabel(feature, model.labels ?? {});
  const favoring = contributions
    .filter(({ feature, value }) => value > 0 && labelOf(feature) !== null)
    .sort((a, b) => b.value - a.value)
    .slice(0, 2)
    .flatMap(({ feature }) => labelOf(feature) ?? []);
  const reason =
    favoring.length > 0
      ? `Pesa a favor no gosto de vocês: ${joinPortuguese(favoring)}`
      : 'Pouco em comum com o que vocês põem no topo';
  return { score, reason };
}

/** Frequência de cada gênero entre os primeiros da lista (0 a 1). */
export type GenreTaste = Map<string, number>;

/**
 * Conta os gêneros dos primeiros filmes da lista.
 *
 * @param topGenres - Gêneros de cada um dos primeiros filmes, na ordem do ranking.
 * @returns A fração dos filmes que tem cada gênero.
 */
export function buildGenreTaste(topGenres: readonly (readonly string[])[]): GenreTaste {
  const taste: GenreTaste = new Map();
  if (topGenres.length === 0) return taste;
  for (const genres of topGenres) for (const genre of new Set(genres)) taste.set(genre, (taste.get(genre) ?? 0) + 1);
  for (const [genre, count] of taste) taste.set(genre, count / topGenres.length);
  return taste;
}

/**
 * Pontuação simples, enquanto a lista não tem modelo: a chance de pelo menos um dos gêneros do filme
 * estar entre os primeiros da lista, 100 × (1 − Π(1 − frequência)).
 *
 * @param taste - Frequência dos gêneros entre os primeiros da lista.
 * @param genres - Gêneros do filme.
 * @returns Nota de 0 a 100 e o motivo, citando até dois gêneros em comum.
 */
export function scoreByGenreTaste(taste: GenreTaste, genres: readonly string[]): Compat {
  const shared = genres
    .map((genre) => ({ genre, frequency: taste.get(genre) ?? 0 }))
    .filter(({ frequency }) => frequency > 0)
    .sort((a, b) => b.frequency - a.frequency);
  const miss = shared.reduce((product, { frequency }) => product * (1 - frequency), 1);
  const score = Math.round(100 * (1 - miss));
  if (shared.length === 0) return { score, reason: 'Fora dos gêneros que vocês põem no topo' };
  const names = shared.slice(0, 2).map(({ genre }) => genre);
  const noun = names.length === 1 ? 'gênero' : 'gêneros';
  return { score, reason: `${joinPortuguese(names)}: ${noun} que vocês põem no topo` };
}

/**
 * Pontuação sem lista (ou com a lista vazia): a nota do próprio TMDb.
 *
 * @param candidate - Filme do /discover.
 * @param listIsEmpty - Se havia lista, mas sem filmes.
 * @returns Nota de 0 a 100 e o motivo.
 */
export function scoreByTmdbVote(candidate: DiscoverCandidate, listIsEmpty: boolean): Compat {
  const score = candidate.vote === null ? 0 : Math.round(candidate.vote * 10);
  return { score, reason: listIsEmpty ? 'Nota do TMDb (a lista ainda está vazia)' : 'Nota do TMDb' };
}

/**
 * Texto de uma variável para o motivo, ou null quando ela não diz nada para quem lê (nota, votos) ou
 * é uma palavra-chave sem rótulo em português (nunca aparece em inglês).
 *
 * @param feature - Nome da variável.
 * @param labels - Rótulos em português das palavras-chave, por nome em inglês (RecsModel.labels).
 * @returns O texto, como "Comédia", "anos 1990" ou "viagem no tempo".
 */
function featureLabel(feature: string, labels: Readonly<Record<string, string>>): string | null {
  const [kind, ...rest] = feature.split(':');
  const value = rest.join(':');
  if (kind === 'genre' && value) return value;
  if (kind === 'decade' && value) return `anos ${value}`;
  if (kind === 'keyword' && value) return labels[value] ?? null;
  return null;
}

/**
 * Junta nomes com vírgula e "e" no fim.
 *
 * @param items - Nomes.
 * @returns "A", "A e B" ou "A, B e C".
 */
function joinPortuguese(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}
