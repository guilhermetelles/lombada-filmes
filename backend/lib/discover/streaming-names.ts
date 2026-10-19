import { streamingServiceByName } from './discover-vocabulary.js';

/** Serviço vendido dentro de outra loja ("Paramount+ Amazon Channel"): fica só se o serviço base não estiver na lista. */
const CHANNEL_SUFFIX = /\s+(?:amazon|apple tv|prime video|roku premium|google play|claro tv\+?)\s+channels?$/i;

/** Plano do mesmo serviço ("Netflix basic with Ads", "Paramount Plus Premium"): vira o serviço. */
const PLAN_SUFFIX = /\s+(?:(?:basic|standard)\s+)?with\s+ads$|\s+(?:premium|essential|basic|standard)$/i;

/**
 * Nome único de um serviço: sem o plano, com "+" lido como "Plus" e, se for um dos serviços
 * conhecidos da busca, com o nome dela ("Paramount+" e "Paramount Plus Premium" viram
 * "Paramount Plus"; "Max" vira "HBO Max").
 *
 * @param name - Nome como o TMDb devolve.
 * @returns O nome normalizado.
 */
function canonicalServiceName(name: string): string {
  const plain = name.replace(PLAN_SUFFIX, '').trim();
  const known = streamingServiceByName(plain) ?? streamingServiceByName(plain.replace(/\s*\+\s*/g, ' plus ').trim());
  return known?.name ?? plain;
}

/**
 * Normaliza os serviços de streaming de um filme no Brasil: junta planos e grafias do mesmo serviço
 * ("Paramount+", "Paramount Plus", "Paramount Plus Premium") e tira o canal vendido em outra loja
 * ("HBO Max Amazon Channel") quando o serviço base também está na lista. Canal sem o serviço base
 * fica, com o nome original. Sem repetidos, na ordem em que vieram.
 *
 * @param names - Nomes como o TMDb devolve (ou como estavam guardados).
 * @returns Os nomes normalizados.
 */
function normalizeStreamingServices(names: readonly string[]): string[] {
  const bases = new Set(names.filter((name) => !CHANNEL_SUFFIX.test(name)).map(canonicalServiceName));
  const result: string[] = [];
  for (const name of names) {
    const channelBase = CHANNEL_SUFFIX.test(name) ? canonicalServiceName(name.replace(CHANNEL_SUFFIX, '')) : null;
    if (channelBase && bases.has(channelBase)) continue;
    const normalized = channelBase ? name.trim() : canonicalServiceName(name);
    if (!result.includes(normalized)) result.push(normalized);
  }
  return result;
}

export { normalizeStreamingServices };
