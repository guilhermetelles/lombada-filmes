import { getProductionDependencies } from '../../lib/dependencies.js';
import { authenticatedRoute } from '../../lib/http/authenticated-route.js';
import { parseInput } from '../../lib/http/parse-input.js';
import { SearchQuery } from '../../lib/schemas/route-inputs.js';

/**
 * GET /api/search?q=&lang=: busca no TMDb e devolve só o que a lista de resultados mostra, com os
 * títulos em pt-BR (padrão) ou, com `lang=en`, em inglês.
 *
 * Responde 200 `{ results }`, 400 se q estiver vazio ou passar de 100 caracteres (ou lang não for
 * pt nem en), 401 sem token
 * válido e 502 se o TMDb falhar.
 */
export const searchRoute = authenticatedRoute(async ({ request, dependencies, usage }) => {
  const params = new URL(request.url).searchParams;
  const { q, lang } = parseInput(SearchQuery, { q: params.get('q') ?? '', lang: params.get('lang') ?? undefined });
  const results = await usage.track('tmdb', () => dependencies.sources.tmdb.search(q, lang));
  return Response.json({ results });
});

/** Handler que a Vercel chama em GET /api/search. */
export const GET = searchRoute(getProductionDependencies);
