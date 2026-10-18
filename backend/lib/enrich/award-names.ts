/**
 * Nomes das premiações e das categorias em português, a partir dos rótulos do Wikidata (pt-br, pt
 * ou en) e das categorias da Wikipedia em inglês. Só as premiações de cinema desta lista entram;
 * o resto (MTV, Calçada da Fama, associações de críticos) fica de fora.
 */

/** Uma premiação conhecida: nome em português e como ela aparece nos rótulos das fontes. */
type KnownOrg = { org: string; pattern: RegExp };

/**
 * Premiações de cinema reconhecidas, na ordem em que o app as mostra. A Framboesa e o BAFTA vêm
 * antes do Oscar no teste porque os rótulos deles podem conter "Academy" ou "Award".
 */
const KNOWN_ORGS: KnownOrg[] = [
  { org: 'Framboesa de Ouro', pattern: /framboesa|golden raspberry|razzie/i },
  { org: 'BAFTA', pattern: /\bbafta\b|british academy/i },
  { org: 'Globo de Ouro', pattern: /golden globe|globo de ouro/i },
  // Sem \b antes do "Ó": no JavaScript, \b só reconhece letras sem acento.
  { org: 'Oscar', pattern: /(?:^|[^\p{L}])[oó]scars?\b|\bacademy awards?\b/iu },
  { org: 'Cannes', pattern: /cannes|palma de ouro|palme d'or/i },
  { org: 'Festival de Veneza', pattern: /venice|veneza|leão de ouro|golden lion|coppa volpi/i },
  { org: 'Festival de Berlim', pattern: /berlin|berlim|urso de (ouro|prata)|golden bear|silver bear/i },
  { org: 'Saturn', pattern: /saturn|saturno/i },
  { org: "Critics' Choice", pattern: /critics'? choice/i },
  { org: 'SAG', pattern: /screen actors guild|sindicato dos atores/i },
  { org: 'Independent Spirit', pattern: /independent spirit/i },
  { org: 'César', pattern: /\bc[ée]sar (award|de|for)\b|prêmio c[ée]sar|^c[ée]sar\b/i },
  { org: 'Goya', pattern: /\bgoya\b/i },
  { org: 'Grand Bell', pattern: /grand bell|daejong/i },
];

/** Ordem das premiações na tela: as conhecidas primeiro, na ordem de KNOWN_ORGS. */
const ORG_ORDER = ['Oscar', 'Globo de Ouro', 'BAFTA', 'Cannes', 'Festival de Veneza', 'Festival de Berlim', 'Saturn'];

/**
 * Categorias em inglês (depois de "Best"), traduzidas. A chave está em minúsculas, com travessões
 * trocados por hífen.
 */
const BEST_CATEGORIES: Record<string, string> = {
  picture: 'filme',
  film: 'filme',
  'motion picture': 'filme',
  'feature film': 'filme',
  director: 'direção',
  directing: 'direção',
  direction: 'direção',
  actor: 'ator',
  actress: 'atriz',
  'actor in a leading role': 'ator',
  'actress in a leading role': 'atriz',
  'leading actor': 'ator',
  'leading actress': 'atriz',
  'supporting actor': 'ator coadjuvante',
  'supporting actress': 'atriz coadjuvante',
  'actor in a supporting role': 'ator coadjuvante',
  'actress in a supporting role': 'atriz coadjuvante',
  'original screenplay': 'roteiro original',
  'adapted screenplay': 'roteiro adaptado',
  screenplay: 'roteiro',
  writing: 'roteiro',
  cinematography: 'fotografia',
  'film editing': 'edição',
  editing: 'edição',
  'visual effects': 'efeitos visuais',
  'special effects': 'efeitos especiais',
  'sound editing': 'edição de som',
  'sound mixing': 'mixagem de som',
  sound: 'som',
  'original score': 'trilha sonora original',
  score: 'trilha sonora',
  music: 'trilha sonora',
  'original song': 'canção original',
  song: 'canção original',
  'production design': 'direção de arte',
  'art direction': 'direção de arte',
  'costume design': 'figurino',
  costume: 'figurino',
  costumes: 'figurino',
  makeup: 'maquiagem',
  'make-up': 'maquiagem',
  'makeup and hairstyling': 'maquiagem',
  'make-up and hair': 'maquiagem',
  'animated feature': 'animação',
  'animated feature film': 'animação',
  'animated film': 'animação',
  'international feature film': 'filme internacional',
  'foreign language film': 'filme internacional',
  'film not in the english language': 'filme internacional',
  'foreign film': 'filme internacional',
  'documentary feature': 'documentário',
  documentary: 'documentário',
  'science fiction film': 'filme de ficção científica',
  'horror film': 'filme de terror',
  'fantasy film': 'filme de fantasia',
  'action or adventure film': 'filme de ação ou aventura',
  'action/adventure film': 'filme de ação ou aventura',
  'action film': 'filme de ação',
  'thriller film': 'filme de suspense',
  'drama picture': 'filme de drama',
  'motion picture - drama': 'filme de drama',
  'musical or comedy picture': 'comédia ou musical',
  'motion picture - musical or comedy': 'comédia ou musical',
  'performance by a younger actor': 'ator ou atriz jovem',
  'young actor': 'ator jovem',
  'young actress': 'atriz jovem',
  'british film': 'filme britânico',
  'outstanding british film': 'filme britânico',
  casting: 'seleção de elenco',
  'special edition dvd release': 'edição especial em DVD',
  'dvd release': 'lançamento em DVD',
};

/** Categorias da Framboesa em inglês (depois de "Worst"), traduzidas. */
const WORST_CATEGORIES: Record<string, string> = {
  picture: 'filme',
  film: 'filme',
  actor: 'ator',
  actress: 'atriz',
  'supporting actor': 'ator coadjuvante',
  'supporting actress': 'atriz coadjuvante',
  director: 'direção',
  screenplay: 'roteiro',
  'screen couple': 'combinação em cena',
  'screen combo': 'combinação em cena',
  'screen ensemble': 'combinação em cena',
  'screen couple/ensemble': 'combinação em cena',
  'prequel, remake, rip-off or sequel': 'remake ou sequência',
  'remake, rip-off or sequel': 'remake ou sequência',
  'remake or sequel': 'remake ou sequência',
  'prequel or sequel': 'remake ou sequência',
  sequel: 'remake ou sequência',
  'original song': 'canção original',
  'new star': 'revelação',
};

/** Prêmios sem "melhor" no nome, reconhecidos pelo rótulo. */
const NAMED_PRIZES: { pattern: RegExp; cat: string }[] = [
  { pattern: /palma de ouro|palme d'or/i, cat: 'Palma de Ouro' },
  { pattern: /leão de ouro|golden lion/i, cat: 'Leão de Ouro' },
  { pattern: /urso de ouro|golden bear/i, cat: 'Urso de Ouro' },
  { pattern: /grand prix|grande prêmio/i, cat: 'Grande Prêmio' },
  { pattern: /prêmio do júri|jury prize/i, cat: 'Prêmio do Júri' },
  { pattern: /achievement in casting|seleção de elenco/i, cat: 'melhor seleção de elenco' },
];

/** Termos de Portugal nos rótulos do Wikidata, trocados pelos usados no Brasil. */
const BRAZILIAN_TERMS: [RegExp, string][] = [
  [/\bsecundári[oa]\b/g, 'coadjuvante'],
  [/\bbanda sonora\b/g, 'trilha sonora'],
  [/\brealização\b/g, 'direção'],
  [/\bmontagem\b/g, 'edição'],
  [/\bcaracterização\b/g, 'maquiagem'],
  [/\bguarda-roupa\b/g, 'figurino'],
  [/\bargumento\b/g, 'roteiro'],
  [/\s+em cinema$/g, ''],
  // "melhor diretor" (Oscar no Wikidata) e "melhor direção" (Wikipedia) são a mesma categoria.
  [/^(melhor|pior) diretor$/g, '$1 direção'],
];

/**
 * Acha a premiação conhecida citada num rótulo.
 *
 * @param label - Rótulo do prêmio (Wikidata) ou nome da categoria (Wikipedia).
 * @returns Nome da premiação em português, ou null se não for uma premiação de cinema conhecida.
 */
function awardOrgOf(label: string): string | null {
  return KNOWN_ORGS.find(({ pattern }) => pattern.test(label))?.org ?? null;
}

/**
 * Tira a categoria de um rótulo de prêmio, em português: "Oscar de melhor fotografia" vira "melhor
 * fotografia", "Saturn Award for Best Director" vira "melhor direção" e "Golden Raspberry Award for
 * Worst Screenplay" vira "pior roteiro". Categoria em inglês fora do dicionário vira null, para não
 * misturar idiomas.
 *
 * @param label - Rótulo do prêmio ou da categoria.
 * @returns A categoria, ou null se o rótulo for genérico ("Saturn Award") ou desconhecido.
 */
function awardCategoryOf(label: string): string | null {
  const match = /\b(best|worst|melhor(?:es)?|pior(?:es)?)\s+(.+)$/i.exec(label.trim());
  if (!match) return NAMED_PRIZES.find(({ pattern }) => pattern.test(label))?.cat ?? null;

  const [, word = '', rest = ''] = match;
  const lower = word.toLowerCase();
  if (lower === 'best' || lower === 'worst') {
    const key = rest.toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').replace(/^the /, '').trim();
    const translated = (lower === 'best' ? BEST_CATEGORIES : WORST_CATEGORIES)[key];
    if (!translated) return null;
    // "efeitos visuais" pede o plural: "melhores efeitos visuais".
    const plural = translated.startsWith('efeitos ');
    return `${lower === 'best' ? (plural ? 'melhores' : 'melhor') : plural ? 'piores' : 'pior'} ${translated}`;
  }
  return toBrazilianPortuguese(`${lower} ${rest.toLowerCase()}`.trim());
}

/**
 * Troca termos de Portugal pelos do Brasil numa categoria já em minúsculas.
 *
 * @param category - Categoria em português.
 * @returns A categoria com os termos do Brasil.
 */
function toBrazilianPortuguese(category: string): string {
  return BRAZILIAN_TERMS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), category).trim();
}

/**
 * Posição de uma premiação na tela: as principais na ordem de ORG_ORDER, as outras conhecidas em
 * seguida, a Framboesa de Ouro por último.
 *
 * @param org - Nome da premiação.
 * @returns Número para ordenar (menor primeiro).
 */
function awardOrgRank(org: string): number {
  if (org === 'Framboesa de Ouro') return 1000;
  const main = ORG_ORDER.indexOf(org);
  if (main >= 0) return main;
  const known = KNOWN_ORGS.findIndex((known) => known.org === org);
  return known >= 0 ? 100 + known : 500;
}

export { awardCategoryOf, awardOrgOf, awardOrgRank, toBrazilianPortuguese };
