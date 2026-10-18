import { awardCategoryOf, awardOrgOf } from '../../enrich/award-names.js';
import type { AwardItem } from '../../types/awards.js';

/**
 * Nome da premiação dentro do nome da categoria, para cortar a categoria do prêmio ("Best Sound
 * Editing Academy Award" vira "Best Sound Editing").
 */
const ORG_IN_CATEGORY =
  /\s+(Academy Award|BAFTA|Golden Globe|Golden Raspberry|Saturn Award|César|Goya|Critics' Choice|Independent Spirit)\b.*$/;

/**
 * Converte uma categoria de artigo da Wikipedia em inglês num prêmio, quando ela registra uma
 * vitória ou indicação numa premiação de cinema conhecida: "Golden Raspberry Award–winning films"
 * vira uma vitória da Framboesa de Ouro sem categoria; "Films that won the Best Visual Effects
 * Academy Award" vira o Oscar de melhores efeitos visuais. As categorias não trazem o ano.
 *
 * @param category - Título da categoria, com ou sem o prefixo "Category:".
 * @returns O prêmio, ou null se a categoria não for de prêmio conhecido.
 */
function categoryToAward(category: string): AwardItem | null {
  const name = category.replace(/^Category:/, '').trim();
  const kind = /winn|\bwon\b|winning/i.test(name) ? 'win' : /nominat/i.test(name) ? 'nom' : null;
  if (!kind) return null;
  const org = awardOrgOf(name);
  if (!org) return null;

  // "Films whose director won the Best Directing Academy Award" -> "Best Directing".
  const best = /\b(Best|Worst) .+/.exec(name)?.[0].replace(ORG_IN_CATEGORY, '') ?? null;
  return { org, cat: awardCategoryOf(best ?? name), kind, year: null };
}

export { categoryToAward };
