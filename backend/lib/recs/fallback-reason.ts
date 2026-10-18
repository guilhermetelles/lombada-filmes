import { scoreWithModel } from '../discover/score-candidates.js';
import type { RecsModel } from '../types/recs.js';
import type { ListIndex, ScoredRec } from './score-recs.js';

/** Quantas marcas em comum o motivo cita, no máximo. */
const SHARED_LABELS = 2;

/**
 * Motivo de reserva, quando o Gemini falha ou não há chave: monta a frase só com dados reais (a
 * saga, o diretor, o filme da lista mais parecido e a posição dele, ou as variáveis que mais pesam
 * no modelo). Exemplos de forma: "Mesmo diretor de Alien (Ridley Scott), #3 na lista de vocês".
 *
 * @param rec - Sugestão pontuada.
 * @param index - Índice da lista.
 * @param model - Modelo da lista, para o caso sem filme parecido.
 * @returns A frase.
 */
function fallbackReason(rec: ScoredRec, index: ListIndex, model: RecsModel): string {
  const prefix =
    rec.source === 'trending' ? 'Em alta nesta semana' : rec.source === 'nowPlaying' ? 'Em cartaz no Brasil' : '';

  if (rec.anchor) {
    const { film, via, label } = rec.anchor;
    const where = `#${film.position} na lista de vocês`;
    const sentence =
      via === 'saga'
        ? `da saga ${label}, como ${film.movie.title}, ${where}`
        : `mesmo diretor de ${film.movie.title} (${label}), ${where}`;
    return prefix ? `${prefix}, ${sentence}` : capitalize(sentence);
  }

  const nearest = rec.neighbors[0];
  const film = nearest ? index.byEntryId.get(nearest.entryId) : undefined;
  if (film) {
    const shared = sharedLabels(rec.tags, film.movie.genres, film.movie.keywords ?? []);
    const sentence = `parecido com ${film.movie.title}, #${film.position} na lista de vocês${shared ? ` (${shared})` : ''}`;
    return prefix ? `${prefix} e ${sentence}` : capitalize(sentence);
  }

  if (prefix) return prefix;
  return scoreWithModel(model, rec.features).reason;
}

/**
 * Gêneros e palavras-chave que o candidato divide com o filme da lista, para citar no motivo.
 *
 * @param tags - Marcas do candidato.
 * @param genres - Gêneros do filme da lista.
 * @param keywords - Palavras-chave do filme da lista.
 * @returns Até duas, separadas por vírgula, ou texto vazio.
 */
function sharedLabels(
  tags: ReadonlyMap<string, number>,
  genres: readonly string[],
  keywords: readonly string[],
): string {
  const shared = [
    ...keywords.filter((keyword) => tags.has(`keyword:${keyword}`)),
    ...genres.filter((genre) => tags.has(`genre:${genre}`)),
  ];
  return shared.slice(0, SHARED_LABELS).join(', ');
}

/**
 * Põe a primeira letra em maiúscula.
 *
 * @param text - Frase.
 * @returns A frase com a primeira letra maiúscula.
 */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export { fallbackReason };
