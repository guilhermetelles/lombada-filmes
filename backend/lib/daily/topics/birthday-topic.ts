import { joinPt } from '../../notify/portuguese-text.js';
import { PersonSchema } from '../../schemas/person.js';
import type { DailyContent, DailyContext } from '../daily-content.js';
import { isDay, nearestAnniversary } from '../day-math.js';
import { recurrentPeople } from '../recurrent-people.js';
import { whenText, yearsText } from './anniversary-text.js';

/** Quantos filmes da lista aparecem pelo nome antes de "e outros". */
const NAMED_FILMS = 3;

/**
 * Aniversário de pessoa: alguém recorrente na lista (diretor ou elenco) que faz aniversário hoje ou
 * amanhã, pela data de nascimento de people/{id} (só fichas já buscadas). Quem já morreu "faria".
 *
 * @param context - Banco, lista e dia.
 * @returns A notificação, ou null se ninguém da lista fizer aniversário hoje ou amanhã.
 */
async function composeBirthday({ dependencies, list, day }: DailyContext): Promise<DailyContent | null> {
  const people = recurrentPeople(list);
  if (people.size === 0) return null;
  const { db } = dependencies;
  const snapshots = await db.getAll(...[...people.keys()].map((personId) => db.doc(`people/${personId}`)));

  const candidates = snapshots.flatMap((snapshot) => {
    const parsed = PersonSchema.safeParse(snapshot.data());
    const linked = people.get(Number(snapshot.id));
    if (!parsed.success || !linked || !isDay(parsed.data.birthday)) return [];
    const anniversary = nearestAnniversary(parsed.data.birthday, day);
    return anniversary.gap === 0 || anniversary.gap === 1 ? [{ person: parsed.data, linked, anniversary }] : [];
  });
  candidates.sort(
    (a, b) =>
      a.anniversary.gap - b.anniversary.gap ||
      Number(a.person.deathday !== null) - Number(b.person.deathday !== null) ||
      b.linked.directed.length + b.linked.acted.length - (a.linked.directed.length + a.linked.acted.length),
  );

  const [pick] = candidates;
  if (!pick) return null;
  const { person, linked, anniversary } = pick;
  const verb = person.deathday ? 'faria' : 'faz';
  const films = [...new Set([...linked.directed, ...linked.acted])];
  const named = joinPt(films.slice(0, NAMED_FILMS));
  return {
    type: 'daily.birthday',
    title: `${person.name} ${verb} ${yearsText(anniversary.years)} ${whenText(anniversary)}`,
    body: `Na lista de vocês: ${films.length > NAMED_FILMS ? `${films.slice(0, NAMED_FILMS).join(', ')} e outros` : named}.`,
    route: { name: 'person', args: { personId: linked.personId } },
  };
}

export { composeBirthday };
