import type { CastMember } from '../../types/person.js';
import {
  buildQuestion,
  type Choice,
  type GeneratedQuiz,
  type QuizGeneratorContext,
  WRONG_OPTIONS,
} from '../build-question.js';
import { restedEntries } from '../quiz-history.js';
import { movieLabel } from '../quiz-text.js';
import { pick, shuffle } from '../seeded-random.js';

/** A pergunta usa os filmes do topo do ranking, que vocês conhecem melhor. */
const TOP_ENTRIES = 10;

/** Só o elenco principal (os primeiros dos créditos) entra nas alternativas. */
const MAIN_CAST = 8;

/** Endereço da foto de uma pessoa no TMDb, no tamanho que o app usa. */
const PROFILE_BASE_URL = 'https://image.tmdb.org/t/p/w185';

/**
 * Elenco principal com personagem informado, sem nomes repetidos.
 *
 * @param cast - Elenco na ordem dos créditos.
 * @returns Até 8 pessoas com personagem.
 */
function mainCastWithCharacter(cast: readonly CastMember[]): CastMember[] {
  const seen = new Set<string>();
  return cast.slice(0, MAIN_CAST).filter((member) => {
    if (!member.character?.trim() || seen.has(member.name)) return false;
    seen.add(member.name);
    return true;
  });
}

/**
 * Alternativa com o nome da pessoa e a foto do TMDb (null sem foto: o app mostra as iniciais).
 *
 * @param member - Pessoa do elenco.
 * @returns A alternativa.
 */
function castChoice(member: CastMember): Choice {
  return { label: member.name, imageUrl: member.profilePath ? `${PROFILE_BASE_URL}${member.profilePath}` : null };
}

/**
 * Pergunta "Quem fez o personagem … em …?": um filme entre os 10 primeiros da lista; as erradas são
 * outras pessoas do elenco principal do mesmo filme.
 *
 * @param context - Material da lista e gerador com semente.
 * @returns A pergunta, ou undefined se nenhum filme do topo tiver 4 pessoas com personagem.
 */
async function generateCharacterQuiz({
  material,
  random,
  recentMovieIds,
}: QuizGeneratorContext): Promise<GeneratedQuiz | undefined> {
  const candidates = restedEntries(material.entries.slice(0, TOP_ENTRIES), recentMovieIds).filter(
    (entry) => mainCastWithCharacter(entry.movie?.cast ?? []).length > WRONG_OPTIONS,
  );
  const target = pick(candidates, random);
  if (!target) return undefined;

  const cast = mainCastWithCharacter(target.movie?.cast ?? []);
  const withPhoto = cast.filter((member) => member.profilePath);
  const chosen = pick(withPhoto.length > WRONG_OPTIONS ? withPhoto : cast, random);
  if (!chosen?.character) return undefined;
  const wrong = shuffle(
    cast.filter((member) => member.id !== chosen.id),
    random,
  ).slice(0, WRONG_OPTIONS);

  return buildQuestion(
    {
      type: 'personagem',
      prompt: `Quem fez o personagem ${chosen.character} em ${target.title}?`,
      explanation: `${chosen.name} fez ${chosen.character} em ${movieLabel(target)}, o #${target.rank} da lista de vocês.`,
      tmdbId: target.tmdbId,
    },
    castChoice(chosen),
    wrong.map(castChoice),
    random,
  );
}

export { generateCharacterQuiz };
