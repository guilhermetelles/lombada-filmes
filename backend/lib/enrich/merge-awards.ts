import type { AwardItem } from '../types/awards.js';
import { awardOrgRank } from './award-names.js';

/** Um prêmio durante a junção, com a chave que reconhece a mesma categoria escrita de outro jeito. */
type MergingAward = AwardItem & { key: string };

/**
 * Chave para reconhecer a mesma categoria escrita de jeitos diferentes pelas fontes ("melhor
 * diretor" e "melhor direção", "melhores efeitos visuais" e "efeitos visuais").
 *
 * @param cat - Categoria em português, ou null.
 * @returns A chave; vazia quando não há categoria.
 */
function awardKey(cat: string | null): string {
  return (cat ?? '')
    .toLowerCase()
    .replace(/\b(melhor|melhores|pior|piores)\s+/g, '')
    .replace(/\s+em cinema$/, '')
    .replace(/^filme (de|em)\s+/, (prefix) => (prefix.includes('em') ? 'em ' : ''))
    .replace(/\bdiretor\b/, 'direção')
    .replace(/seleção de elenco/, 'elenco')
    .replace(/(trilha|banda) sonora( original)?/, 'trilha sonora')
    .trim();
}

/**
 * Junta os prêmios de várias fontes (Wikidata nos dois sentidos e Wikipedia) sem repetir: a mesma
 * premiação e categoria no mesmo ano (ou com o ano faltando de um lado) viram um item só, e vitória
 * vale mais que indicação. O filme do prêmio (`for`, prêmios de pessoas) passa adiante: dois itens
 * com filmes diferentes continuam separados, e o que não diz o filme ganha o do outro. Item sem categoria só fica quando a premiação não tem um item mais
 * específico pelo menos tão forte (uma vitória genérica fica ao lado de indicações específicas).
 * A saída vem por premiação (Oscar primeiro, Framboesa por último), com as vitórias antes das
 * indicações e, dentro delas, por ano.
 *
 * @param lists - Prêmios de cada fonte.
 * @returns Os prêmios juntos e ordenados.
 */
function mergeAwards(...lists: AwardItem[][]): AwardItem[] {
  const items: MergingAward[] = lists.flat().map((item) => ({ ...item, key: awardKey(item.cat) }));
  // Primeiro os que têm ano (Wikidata, nome completo); os sem ano se juntam a eles.
  items.sort((a, b) => Number(b.year !== null) - Number(a.year !== null));

  const merged: MergingAward[] = [];
  for (const item of items) {
    const same = merged.find(
      (other) =>
        other.org === item.org &&
        other.key === item.key &&
        (other.year === null || item.year === null || other.year === item.year) &&
        (!other.for || !item.for || other.for === item.for),
    );
    if (!same) {
      merged.push({ ...item });
      continue;
    }
    if (item.kind === 'win') same.kind = 'win';
    same.year = same.year ?? item.year;
    same.cat = same.cat ?? item.cat;
    if (!same.for && item.for) same.for = item.for;
  }

  return merged
    .filter(
      (item) =>
        item.key ||
        !merged.some((other) => other.org === item.org && other.key && (item.kind === 'nom' || other.kind === 'win')),
    )
    .sort(
      (a, b) =>
        awardOrgRank(a.org) - awardOrgRank(b.org) ||
        a.org.localeCompare(b.org) ||
        Number(a.kind === 'nom') - Number(b.kind === 'nom') ||
        (a.year ?? 9999) - (b.year ?? 9999) ||
        (a.cat ?? '').localeCompare(b.cat ?? ''),
    )
    .map(({ org, cat, kind, year, for: work }) => ({ org, cat, kind, year, ...(work && { for: work }) }));
}

export { mergeAwards };
