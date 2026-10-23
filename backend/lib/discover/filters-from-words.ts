import type { Dec, Dur, Filters } from '../types/discover.js';

/** Palavras de filme curto (até 90 minutos), já sem acento. "longa" fica de fora: "um longa" é longa-metragem. */
const SHORT_WORDS = /\b(?:curt[oa]s?|curtinh[oa]s?|rapid[oa]s?|rapidinh[oa]s?)\b/;

/** Palavras de filme longo (mais de 2 horas), já sem acento. */
const LONG_WORDS = /\b(?:longos?|epic[oa]s?)\b/;

/** "anos 90", "anos 1990", "década de 80", "anos 2000": o número da década, já sem acento. */
const DECADE_WORDS = /\b(?:anos|decada de)\s+(\d{2,4})\b/g;

/**
 * Palavras que falam da época de lançamento, já sem acento: sem nenhuma delas, a década que o
 * modelo mandar é inventada ("romance futuro" voltava com 2000 a 2020).
 */
const RELEASE_ERA_WORDS =
  /\b(?:anos\s+\d+|decadas?|antig[oa]s?|classic[oa]s?|velh[oa]s?|recentes?|nov[oa]s?|lancad[oa]s?|lancamentos?|atua(?:l|is)|modern[oa]s?|ultimos\s+anos|(?:19|20)\d{2})\b/;

/** Década dita no pedido → valor do filtro `dec`. Anos 20 a 60 caem em "antes70". */
const DECADES: Record<string, Dec> = {
  '20': 'antes70',
  '30': 'antes70',
  '40': 'antes70',
  '50': 'antes70',
  '60': 'antes70',
  '1920': 'antes70',
  '1930': 'antes70',
  '1940': 'antes70',
  '1950': 'antes70',
  '1960': 'antes70',
  '70': '1970',
  '1970': '1970',
  '80': '1980',
  '1980': '1980',
  '90': '1990',
  '1990': '1990',
  '2000': '2000',
  '2010': '2010',
  '2020': '2020',
};

/**
 * Lê no pedido as palavras de duração e de década que a instrução do Gemini fixa (regras 3 e 5),
 * sem depender do modelo: os modelos Lite, que respondem quando o 3.8 Flash está fora, perdem
 * "curto", "rápido" e "anos 90" em boa parte das vezes.
 *
 * @param text - Frase digitada.
 * @returns Só os grupos `dur` e `dec` encontrados (vazio se nenhum).
 */
function filtersFromWords(text: string): Pick<Filters, 'dur' | 'dec'> {
  const plain = plainText(text);
  const found: Pick<Filters, 'dur' | 'dec'> = {};
  const dur: Dur[] = [
    ...(SHORT_WORDS.test(plain) ? ['ate90' as const] : []),
    ...(LONG_WORDS.test(plain) ? ['mais120' as const] : []),
  ];
  if (dur.length > 0) found.dur = dur;
  const dec = [...new Set([...plain.matchAll(DECADE_WORDS)].flatMap(([, decade]) => DECADES[decade ?? ''] ?? []))];
  if (dec.length > 0) found.dec = dec;
  return found;
}

/**
 * Diz se o pedido fala da época de lançamento ("anos 90", "antigo", "recente", "de 1995"). Sem
 * isso, a década do modelo é descartada: "futuro" ou "passado" falam da história, não do lançamento.
 *
 * @param text - Frase digitada.
 * @returns true se alguma palavra de época aparece.
 */
function mentionsReleaseEra(text: string): boolean {
  return RELEASE_ERA_WORDS.test(plainText(text));
}

/**
 * Minúsculas e sem acento, para as palavras serem achadas de qualquer jeito que forem digitadas.
 *
 * @param text - Frase digitada.
 * @returns A frase sem acento e em minúsculas.
 */
function plainText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

export { filtersFromWords, mentionsReleaseEra };
