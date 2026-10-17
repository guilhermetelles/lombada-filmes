/**
 * Confere que o Admin SDK lê o lombada-db de verdade, com a conta de serviço do .env da raiz, e
 * resume o Teste de Bechdel dos filmes de cada lista.
 * Uso: npm run check:firestore
 */
import { getProductionDependencies } from '../lib/dependencies.js';
import { listMovies } from '../lib/movies/movie-repository.js';

process.loadEnvFile(new URL('../../.env', import.meta.url));

const { db } = getProductionDependencies();
const collections = await db.listCollections();
const names = collections.map((collection) => collection.id).join(', ') || '(nenhuma ainda)';
console.log(`leitura ok; coleções: ${names}`);

const movies = new Map((await listMovies(db)).map(({ tmdbId, movie }) => [tmdbId, movie]));
for (const list of (await db.collection('lists').get()).docs) {
  const entries = await list.ref.collection('entries').get();
  const bechdel = entries.docs.map((entry) => movies.get(Number(entry.get('tmdbId')))?.bechdel);
  const matched = bechdel.filter((value) => typeof value?.siteId === 'number');
  const byRating = [3, 2, 1, 0].map(
    (rating) => `${rating}: ${matched.filter((value) => value?.rating === rating).length}`,
  );
  const passing =
    matched.length === 0
      ? 0
      : Math.round((100 * matched.filter((value) => value?.rating === 3).length) / matched.length);
  console.log(
    [
      `lista ${list.id}: ${entries.size} filmes`,
      `  Teste de Bechdel: ${matched.length} casados, ${bechdel.filter((value) => value?.siteId === null).length} fora do site, ${bechdel.filter((value) => value === undefined).length} nunca buscados`,
      `  critérios (${byRating.join(', ')}), ${passing}% passam nos 3, ${matched.filter((value) => value?.dubious).length} duvidosas`,
    ].join('\n'),
  );
}
