import { awardCategoryOf, awardOrgOf } from '../../enrich/award-names.js';
import type { WikidataAwardRow } from '../../schemas/sources/wikidata.js';
import type { AwardItem } from '../../types/awards.js';
import type { AwardsById } from '../../types/sources.js';

/** O serviço de rótulos devolve o próprio id (Q123) quando o item não tem rótulo nos idiomas pedidos. */
const MISSING_LABEL = /^Q\d+$/;

/**
 * Lê um rótulo, tratando o id sem rótulo como ausente.
 *
 * @param binding - Valor da linha, se houver.
 * @returns O rótulo, ou null.
 */
function labelOf(binding: { value: string } | undefined): string | null {
  const value = binding?.value.trim();
  return value && !MISSING_LABEL.test(value) ? value : null;
}

/**
 * Converte uma linha da consulta num prêmio: premiação e categoria em português e, quando o
 * qualificador P1686 vem (prêmios de pessoas), por qual filme. Fica de fora a
 * linha sem prêmio (item sem nenhum) e o prêmio que não é de uma premiação de cinema conhecida.
 *
 * @param row - Linha validada.
 * @returns O prêmio, ou null.
 */
function toAwardItem(row: WikidataAwardRow): AwardItem | null {
  const kind = row.kind?.value;
  const award = labelOf(row.awardLabel);
  if ((kind !== 'win' && kind !== 'nom') || !award) return null;

  // No sentido inverso, o prêmio pode ser a cerimônia, e a categoria vem no qualificador P642.
  const category = labelOf(row.catLabel);
  const org = awardOrgOf(award) ?? (category ? awardOrgOf(category) : null);
  if (!org) return null;

  const year = row.year ? Number.parseInt(row.year.value, 10) : Number.NaN;
  const work = labelOf(row.forLabel);
  return {
    org,
    cat: (category ? awardCategoryOf(category) : null) ?? awardCategoryOf(award),
    kind,
    year: Number.isFinite(year) ? year : null,
    ...(work && { for: work }),
  };
}

/**
 * Agrupa as linhas da consulta em prêmios por id do TMDb, ainda com repetições (a junção tira).
 * Quem não tem prêmio de premiação conhecida fica fora do mapa.
 *
 * @param rows - Linhas validadas.
 * @returns Prêmios por id do TMDb.
 */
function toAwardsById(rows: WikidataAwardRow[]): AwardsById {
  const awards: AwardsById = new Map();
  for (const row of rows) {
    const item = toAwardItem(row);
    if (!item) continue;
    const tmdbId = Number(row.tmdb.value);
    awards.set(tmdbId, [...(awards.get(tmdbId) ?? []), item]);
  }
  return awards;
}

/**
 * Tira das linhas o título do artigo de cada filme na Wikipedia em inglês.
 *
 * @param rows - Linhas validadas da consulta de filmes.
 * @returns Título do artigo por id do TMDb ("The Twilight Saga: Breaking Dawn – Part 2").
 */
function toEnwikiTitles(rows: WikidataAwardRow[]): Map<number, string> {
  const titles = new Map<number, string>();
  for (const row of rows) {
    const url = row.article?.value;
    const path = url?.startsWith('https://en.wikipedia.org/wiki/')
      ? url.slice('https://en.wikipedia.org/wiki/'.length)
      : null;
    if (!path) continue;
    titles.set(Number(row.tmdb.value), decodeURIComponent(path).replaceAll('_', ' '));
  }
  return titles;
}

export { toAwardsById, toEnwikiTitles };
