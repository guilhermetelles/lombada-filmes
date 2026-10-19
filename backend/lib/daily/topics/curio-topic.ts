import { formatDollars } from '../../notify/portuguese-text.js';
import type { AwardItem } from '../../types/awards.js';
import type { Movie } from '../../types/movie.js';
import type { DailyContent, DailyContext } from '../daily-content.js';
import { pickSeeded } from '../day-seed.js';

/** Premiações na ordem em que valem como curiosidade (as outras vêm depois). */
const AWARD_ORDER = ['Oscar', 'Framboesa de Ouro', 'Globo de Ouro', 'BAFTA', 'Cannes', 'Saturn'];

/** Uma curiosidade de um filme da lista. */
type Fact = { tmdbId: number; text: string };

/**
 * Curiosidade sobre um filme da lista, sorteada no dia entre as que os dados de movies/ permitem:
 * orçamento e bilheteria mundial, título no Brasil diferente do original e prêmio vencido.
 *
 * @param context - Lista e dia.
 * @returns A notificação, ou null se nenhum filme tiver esses dados.
 */
async function composeCurio({ list, day }: DailyContext): Promise<DailyContent | null> {
  const facts: Fact[] = [];
  for (const tmdbId of new Set(list.entries.map((entry) => entry.tmdbId))) {
    const movie = list.movies.get(tmdbId);
    if (movie) facts.push(...factsOf(tmdbId, movie));
  }

  const fact = pickSeeded(facts, `${day}:curiosidade:${list.listId}`);
  if (!fact) return null;
  return {
    type: 'daily.curio',
    title: 'Você sabia?',
    body: fact.text,
    route: { name: 'movie', args: { tmdbId: fact.tmdbId } },
  };
}

/**
 * Curiosidades possíveis de um filme.
 *
 * @param tmdbId - Id do filme no TMDb.
 * @param movie - Documento do filme.
 * @returns Zero a três curiosidades.
 */
function factsOf(tmdbId: number, movie: Movie): Fact[] {
  const facts: Fact[] = [];
  const { budget, revenue, titlePt } = movie;
  // Filme lançado direto em streaming quase não tem bilheteria: o fato daria uma ideia errada de fracasso.
  if (budget && revenue && budget > 0 && revenue > 0 && movie.streamingFirst !== true) {
    const verb = revenue >= budget ? 'faturou' : 'só faturou';
    facts.push({
      tmdbId,
      text: `${movie.title} custou ${formatDollars(budget)} e ${verb} ${formatDollars(revenue)} no mundo.`,
    });
  }
  if (titlePt && titlePt.trim().toLowerCase() !== movie.title.trim().toLowerCase()) {
    facts.push({ tmdbId, text: `No Brasil, ${movie.title} se chamou ${titlePt}.` });
  }
  const award = bestWin(movie.awards?.items ?? []);
  if (award) {
    const category = award.cat ? ` de ${award.cat}` : '';
    const year = award.year ? ` em ${award.year}` : '';
    facts.push({ tmdbId, text: `${movie.title} ganhou o prêmio ${award.org}${category}${year}.` });
  }
  return facts;
}

/**
 * Escolhe o prêmio vencido mais conhecido (Oscar primeiro, depois Framboesa de Ouro…).
 *
 * @param items - Prêmios e indicações do filme.
 * @returns O prêmio vencido, ou undefined se o filme não venceu nenhum.
 */
function bestWin(items: readonly AwardItem[]): AwardItem | undefined {
  const rank = (org: string) => {
    const index = AWARD_ORDER.indexOf(org);
    return index === -1 ? AWARD_ORDER.length : index;
  };
  return items.filter((item) => item.kind === 'win').sort((a, b) => rank(a.org) - rank(b.org))[0];
}

export { composeCurio };
