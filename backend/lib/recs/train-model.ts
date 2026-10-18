import type { RecsModel } from '../types/recs.js';

/** Versão do modelo gravada em recs/current.modelVersion; muda quando as contas mudam. */
export const MODEL_VERSION = 'pairwise-logit-v1';

/** Máximo de variáveis do modelo (o schema de recs/current recusa mais). */
export const MAX_FEATURES = 300;

/** Variáveis numéricas, que entram sempre no vocabulário (as outras valem 0 ou 1). */
const NUMERIC_FEATURES = ['vote', 'votesLog', 'popularityLog'] as const;

/** Em quantos filmes da lista uma variável de 0 ou 1 precisa aparecer para entrar no modelo. */
const MIN_DOCUMENT_FREQUENCY = 2;

/** Máximo de pares (i acima de j) usados no ajuste; acima disso, uma amostra regular. */
const MAX_PAIRS = 20_000;

/** Regularização L2, passo e número de passos da descida do gradiente. */
const TRAINING = { l2: 0.02, learningRate: 1, iterations: 300 } as const;

/**
 * Linha de base em forma de modelo: 100 × sigmoide(8 × (nota/10 − 0,65)). Nota 6,5 do TMDb dá 50,
 * 8 dá 77 e 5 dá 23, na mesma ordem da nota.
 */
const BASELINE = { slope: 8, center: 0.65 } as const;

/** Com quantos filmes na lista o modelo deixa de ser misturado com a linha de base por falta de dados. */
const FULL_TRUST_FILMS = 30;

/** Abaixo disso não há como separar filmes para conferir o modelo: só a linha de base. */
const MIN_FILMS_TO_TRAIN = 5;

/** Acerto nos pares dos filmes separados a partir do qual o modelo vale inteiro (0,5 é chute). */
const GOOD_HOLDOUT_ACCURACY = 0.62;

/** Um em cada tantos filmes fica de fora do ajuste para conferir o modelo. */
const HOLDOUT_EVERY = 5;

/** Variáveis de cada filme, na ordem do ranking (o primeiro é o do topo). */
export type RankedFeatures = readonly Readonly<Record<string, number>>[];

/** Resultado do ajuste: o modelo já misturado e o que decidiu a mistura. */
export type FittedModel = {
  model: RecsModel;
  alpha: number; // peso do modelo aprendido na mistura com a linha de base (0 a 1)
  holdoutAccuracy: number | null; // acerto nos pares dos filmes separados; null com poucos filmes
  films: number;
};

/** Pesos aprendidos (sem viés) sobre um vocabulário. */
type PairwiseWeights = { vocabulary: string[]; weights: Float64Array };

/** Diferença esparsa de variáveis de um par: índices no vocabulário e valores. */
type SparsePair = { indices: Int32Array; values: Float64Array };

/**
 * Ajusta o modelo de compatibilidade da lista: regressão logística sobre pares do ranking (o filme
 * i acima do j vira o exemplo x_i − x_j), com L2 e vocabulário limitado. O viés põe o filme médio da
 * lista em 50. Com poucos filmes, ou quando o modelo erra os pares dos filmes separados para
 * conferir, ele é misturado à linha de base (nota do TMDb): pesos e viés viram
 * α × aprendido + (1 − α) × linha de base, e o resultado continua sendo um modelo que a busca e a
 * página do filme leem igual.
 *
 * @param ranked - Variáveis de cada filme, do topo para baixo.
 * @returns O modelo misturado e o que decidiu a mistura.
 */
export function fitListModel(ranked: RankedFeatures): FittedModel {
  const films = ranked.length;
  if (films < MIN_FILMS_TO_TRAIN) {
    return { model: blendWithBaseline(undefined, 0), alpha: 0, holdoutAccuracy: null, films };
  }

  const holdoutAccuracy = measureHoldoutAccuracy(ranked);
  const countFactor = Math.min(1, films / FULL_TRUST_FILMS);
  const qualityFactor = holdoutAccuracy === null ? 0 : clamp((holdoutAccuracy - 0.5) / (GOOD_HOLDOUT_ACCURACY - 0.5));
  const alpha = countFactor * qualityFactor;

  const learned = alpha > 0 ? toModel(fitPairwise(ranked), ranked) : undefined;
  return { model: blendWithBaseline(learned, alpha), alpha, holdoutAccuracy, films };
}

/**
 * Ajusta só os pesos aprendidos (sem mistura), para avaliação e testes.
 *
 * @param ranked - Variáveis de cada filme, do topo para baixo.
 * @returns O modelo aprendido, com o viés que põe o filme médio da lista em 50.
 */
export function fitLearnedModel(ranked: RankedFeatures): RecsModel {
  return toModel(fitPairwise(ranked), ranked);
}

/**
 * O logit de um filme no modelo: viés mais a soma dos pesos pelas variáveis conhecidas.
 *
 * @param model - Viés e pesos.
 * @param features - Variáveis do filme.
 * @returns O logit (100 × sigmoide dele é a nota).
 */
export function modelLogit(model: RecsModel, features: Readonly<Record<string, number>>): number {
  let logit = model.bias;
  for (const [feature, value] of Object.entries(features)) logit += (model.weights[feature] ?? 0) * value;
  return logit;
}

/**
 * Nota de 0 a 100 de um filme no modelo, igual à de scoreWithModel, sem arredondar.
 *
 * @param model - Viés e pesos.
 * @param features - Variáveis do filme.
 * @returns 100 × sigmoide do logit.
 */
export function modelScore(model: RecsModel, features: Readonly<Record<string, number>>): number {
  return 100 * sigmoid(modelLogit(model, features));
}

/**
 * Escolhe o vocabulário: as variáveis numéricas e as de 0 ou 1 que aparecem em pelo menos dois
 * filmes, das mais frequentes para as menos, até 300 no total.
 *
 * @param ranked - Variáveis de cada filme.
 * @returns Os nomes das variáveis, em ordem fixa.
 */
export function selectVocabulary(ranked: RankedFeatures): string[] {
  const frequency = new Map<string, number>();
  for (const features of ranked)
    for (const name of Object.keys(features)) frequency.set(name, (frequency.get(name) ?? 0) + 1);

  const numeric: string[] = NUMERIC_FEATURES.filter((name) => frequency.has(name));
  const binary = [...frequency]
    .filter(([name, count]) => !numeric.includes(name) && count >= MIN_DOCUMENT_FREQUENCY)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
  return [...numeric, ...binary].slice(0, MAX_FEATURES);
}

/**
 * Acerto do modelo em filmes que ele não viu: separa um em cada cinco filmes, ajusta com os outros
 * e conta, entre os pares que têm um filme separado, quantos ficam na ordem do ranking.
 *
 * @param ranked - Variáveis de cada filme, do topo para baixo.
 * @returns A fração de pares na ordem certa, ou null se não houver filmes suficientes.
 */
function measureHoldoutAccuracy(ranked: RankedFeatures): number | null {
  const heldOut = new Set<number>();
  for (let index = 2; index < ranked.length; index += HOLDOUT_EVERY) heldOut.add(index);
  const trainingRows = ranked.filter((_, index) => !heldOut.has(index));
  if (heldOut.size === 0 || trainingRows.length < MIN_FILMS_TO_TRAIN - 1) return null;

  const model = toModel(fitPairwise(trainingRows), trainingRows);
  const logits = ranked.map((features) => modelLogit(model, features));
  let right = 0;
  let total = 0;
  for (let i = 0; i < ranked.length; i++) {
    for (let j = i + 1; j < ranked.length; j++) {
      if (!heldOut.has(i) && !heldOut.has(j)) continue;
      const above = logits[i] ?? 0;
      const below = logits[j] ?? 0;
      total += 1;
      if (above > below) right += 1;
      else if (above === below) right += 0.5;
    }
  }
  return total === 0 ? null : right / total;
}

/**
 * Regressão logística sem viés sobre as diferenças dos pares (i acima de j), por descida do
 * gradiente com L2.
 *
 * @param ranked - Variáveis de cada filme, do topo para baixo.
 * @returns O vocabulário e os pesos.
 */
function fitPairwise(ranked: RankedFeatures): PairwiseWeights {
  const vocabulary = selectVocabulary(ranked);
  const index = new Map(vocabulary.map((name, position) => [name, position]));
  const rows = ranked.map((features) => denseRow(features, index, vocabulary.length));
  const pairs = buildPairs(rows);
  const weights = new Float64Array(vocabulary.length);
  if (pairs.length === 0) return { vocabulary, weights };

  const gradient = new Float64Array(vocabulary.length);
  for (let iteration = 0; iteration < TRAINING.iterations; iteration++) {
    gradient.fill(0);
    for (const { indices, values } of pairs) {
      let margin = 0;
      for (let k = 0; k < indices.length; k++) margin += (weights[indices[k] ?? 0] ?? 0) * (values[k] ?? 0);
      // Derivada de log(1 + e^(−margem)) em relação à margem.
      const push = -sigmoid(-margin);
      for (let k = 0; k < indices.length; k++) {
        const at = indices[k] ?? 0;
        gradient[at] = (gradient[at] ?? 0) + push * (values[k] ?? 0);
      }
    }
    for (let at = 0; at < weights.length; at++) {
      const current = weights[at] ?? 0;
      const delta = (gradient[at] ?? 0) / pairs.length + 2 * TRAINING.l2 * current;
      weights[at] = current - TRAINING.learningRate * delta;
    }
  }
  return { vocabulary, weights };
}

/**
 * Monta os pares (i acima de j) com a diferença das variáveis, só nas posições que mudam. Com
 * pares demais, fica uma amostra regular.
 *
 * @param rows - Variáveis densas de cada filme, do topo para baixo.
 * @returns As diferenças esparsas.
 */
function buildPairs(rows: readonly Float64Array[]): SparsePair[] {
  const total = (rows.length * (rows.length - 1)) / 2;
  const stride = Math.max(1, Math.ceil(total / MAX_PAIRS));
  const pairs: SparsePair[] = [];
  let counter = 0;
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (counter++ % stride !== 0) continue;
      const above = rows[i];
      const below = rows[j];
      if (!above || !below) continue;
      const indices: number[] = [];
      const values: number[] = [];
      for (let at = 0; at < above.length; at++) {
        const difference = (above[at] ?? 0) - (below[at] ?? 0);
        if (difference !== 0) {
          indices.push(at);
          values.push(difference);
        }
      }
      if (indices.length > 0) pairs.push({ indices: Int32Array.from(indices), values: Float64Array.from(values) });
    }
  }
  return pairs;
}

/**
 * Converte as variáveis de um filme num vetor na ordem do vocabulário.
 *
 * @param features - Variáveis do filme.
 * @param index - Posição de cada variável no vocabulário.
 * @param size - Tamanho do vocabulário.
 * @returns O vetor.
 */
function denseRow(features: Readonly<Record<string, number>>, index: Map<string, number>, size: number): Float64Array {
  const row = new Float64Array(size);
  for (const [name, value] of Object.entries(features)) {
    const at = index.get(name);
    if (at !== undefined) row[at] = value;
  }
  return row;
}

/**
 * Transforma os pesos aprendidos num modelo, com o viés que põe o filme médio da lista em 50.
 *
 * @param learned - Vocabulário e pesos.
 * @param ranked - Variáveis dos filmes da lista.
 * @returns Viés e pesos por nome.
 */
function toModel({ vocabulary, weights }: PairwiseWeights, ranked: RankedFeatures): RecsModel {
  const named: Record<string, number> = {};
  vocabulary.forEach((name, at) => {
    named[name] = weights[at] ?? 0;
  });
  const withoutBias: RecsModel = { bias: 0, weights: named };
  const meanLogit =
    ranked.length === 0
      ? 0
      : ranked.reduce((sum, features) => sum + modelLogit(withoutBias, features), 0) / ranked.length;
  return { bias: -meanLogit, weights: named };
}

/**
 * Mistura o modelo aprendido com a linha de base (nota do TMDb), já arredondando os pesos para
 * gravar e tirando os que ficaram em zero.
 *
 * @param learned - Modelo aprendido, ou undefined quando só vale a linha de base.
 * @param alpha - Peso do modelo aprendido (0 a 1).
 * @returns O modelo final, com até 300 variáveis.
 */
function blendWithBaseline(learned: RecsModel | undefined, alpha: number): RecsModel {
  const weights: Record<string, number> = {};
  const share = learned ? alpha : 0;
  for (const [name, weight] of Object.entries(learned?.weights ?? {})) weights[name] = share * weight;
  weights.vote = (weights.vote ?? 0) + (1 - share) * BASELINE.slope;
  const bias = share * (learned?.bias ?? 0) + (1 - share) * -BASELINE.slope * BASELINE.center;

  const rounded: Record<string, number> = {};
  const ordered = Object.entries(weights)
    .map(([name, weight]) => [name, round(weight)] as const)
    .filter(([, weight]) => weight !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]) || a[0].localeCompare(b[0]))
    .slice(0, MAX_FEATURES);
  for (const [name, weight] of ordered) rounded[name] = weight;
  return { bias: round(bias), weights: rounded };
}

/**
 * Função logística.
 *
 * @param value - Logit.
 * @returns Valor entre 0 e 1.
 */
export function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

/**
 * Limita um valor ao intervalo de 0 a 1.
 *
 * @param value - Valor.
 * @returns O valor limitado.
 */
function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Arredonda para 4 casas, o bastante para a nota e mais curto de gravar.
 *
 * @param value - Valor.
 * @returns O valor arredondado.
 */
function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
