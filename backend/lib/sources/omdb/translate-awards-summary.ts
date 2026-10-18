/** Premiações citadas pela OMDb e o nome em português, no singular e no plural. */
const AWARD_NAMES: { pattern: RegExp; one: string; many: string }[] = [
  { pattern: /^oscars?$/i, one: 'Oscar', many: 'Oscars' },
  { pattern: /^golden globes?$/i, one: 'Globo de Ouro', many: 'Globos de Ouro' },
  { pattern: /^bafta( film)? awards?$/i, one: 'BAFTA', many: 'BAFTAs' },
  { pattern: /^primetime emmys?$/i, one: 'Emmy', many: 'Emmys' },
];

/**
 * Escreve "N coisa(s)" com o singular ou o plural certo.
 *
 * @param count - Quantidade.
 * @param one - Forma no singular.
 * @param many - Forma no plural.
 * @returns O número seguido da palavra.
 */
function counted(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Traduz uma frase de premiação ("Won 4 Oscars", "Nominated for 1 Golden Globe").
 *
 * @param sentence - Frase da OMDb, sem o ponto final.
 * @returns A frase em português, ou null se a premiação não for conhecida.
 */
function translateAwardSentence(sentence: string): string | null {
  const match = /^(Won|Nominated for) (\d+) (.+)$/i.exec(sentence);
  if (!match) return null;
  const [, verb = '', countText = '', name = ''] = match;
  const award = AWARD_NAMES.find(({ pattern }) => pattern.test(name.trim()));
  if (!award) return null;
  const count = Number(countText);
  const what = counted(count, award.one, award.many);
  return /^won$/i.test(verb) ? `Ganhou ${what}` : `Indicado a ${what}`;
}

/**
 * Traduz a frase dos totais ("42 wins & 52 nominations total", "3 wins", "1 nomination total").
 *
 * @param sentence - Frase da OMDb, sem o ponto final.
 * @returns A frase em português, ou null se não for uma frase de totais.
 */
function translateTotalsSentence(sentence: string): string | null {
  const match = /^(?:(\d+) wins?)?(?:\s*&\s*)?(?:(\d+) nominations?)?( total)?$/i.exec(sentence);
  if (!match || (!match[1] && !match[2])) return null;
  const parts = [
    match[1] ? counted(Number(match[1]), 'prêmio', 'prêmios') : null,
    match[2] ? counted(Number(match[2]), 'indicação', 'indicações') : null,
  ].filter((part) => part !== null);
  return `${parts.join(' e ')}${match[3] ? ' no total' : ''}`;
}

/**
 * Traduz o resumo de prêmios da OMDb para o português, frase por frase: "Won 4 Oscars. 42 wins &
 * 52 nominations total" vira "Ganhou 4 Oscars. 42 prêmios e 52 indicações no total". Frase que não
 * segue um formato conhecido fica de fora, para nunca misturar inglês e português.
 *
 * @param summary - Campo Awards da OMDb (já sem "N/A").
 * @returns O resumo em português, ou null se nenhuma frase for reconhecida.
 */
function translateAwardsSummary(summary: string | null): string | null {
  if (!summary) return null;
  const sentences = summary
    .split('.')
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map((sentence) => translateAwardSentence(sentence) ?? translateTotalsSentence(sentence))
    .filter((sentence) => sentence !== null);
  return sentences.length > 0 ? sentences.join('. ') : null;
}

export { translateAwardsSummary };
