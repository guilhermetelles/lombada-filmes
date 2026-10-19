import { normalizeStreamingServices } from '../../discover/streaming-names.js';
import { findMovies } from '../../movies/movie-repository.js';
import { joinPt } from '../../notify/portuguese-text.js';
import { QueueItemSchema } from '../../schemas/queue.js';
import { brazilDay } from '../../time/brazil-day.js';
import type { DailyContent, DailyContext } from '../daily-content.js';

/**
 * Chegou no streaming: filme da fila "Quero ver" cujo `providersBR` foi buscado hoje e tem serviço
 * por assinatura que não estava na busca anterior (`previous`). O mais antigo da fila primeiro.
 *
 * @param context - Banco, lista e dia.
 * @returns A notificação, ou null se nada da fila chegou num serviço hoje.
 */
async function composeStreaming({ dependencies, list, day }: DailyContext): Promise<DailyContent | null> {
  const { db } = dependencies;
  const queue = (await db.collection(`lists/${list.listId}/queue`).get()).docs.flatMap((doc) => {
    const parsed = QueueItemSchema.safeParse(doc.data());
    return parsed.success ? [parsed.data] : [];
  });
  if (queue.length === 0) return null;
  queue.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const movies = await findMovies(
    db,
    queue.map((item) => item.tmdbId),
  );
  for (const { tmdbId } of queue) {
    const movie = movies.get(tmdbId);
    const providers = movie?.providersBR;
    if (!movie || !providers || brazilDay(providers.fetchedAt) !== day) continue;
    const previous = normalizeStreamingServices(providers.previous);
    const arrived = normalizeStreamingServices(providers.flatrate).filter((service) => !previous.includes(service));
    if (arrived.length === 0) continue;
    return {
      type: 'daily.streaming',
      title: `Chegou no streaming: ${movie.title}`,
      body: `Está na fila de vocês e agora está em ${joinPt(arrived)}.`,
      route: { name: 'movie', args: { tmdbId } },
    };
  }
  return null;
}

export { composeStreaming };
