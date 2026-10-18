import * as z from 'zod';

/** Formato das respostas do serviço SPARQL do Wikidata (application/sparql-results+json). */

/** Um valor de uma linha: só o texto interessa (URI, literal ou número como texto). */
const Binding = z.object({ value: z.string() });

/** Uma linha da consulta de prêmios; as variáveis opcionais faltam quando não casaram. */
const AwardRow = z.object({
  tmdb: Binding, // id do TMDb pedido no VALUES
  kind: Binding.optional(), // "win" ou "nom"; falta quando o item não tem prêmio nenhum
  awardLabel: Binding.optional(),
  catLabel: Binding.optional(), // P642 (de qual categoria) no sentido inverso
  forLabel: Binding.optional(), // P1686 (por qual obra)
  year: Binding.optional(), // ano do P585
  article: Binding.optional(), // artigo na Wikipedia em inglês (só na consulta de filmes)
});

/** Resposta da consulta de prêmios por id do TMDb. */
export const WikidataAwardsResponse = z.object({
  results: z.object({ bindings: z.array(AwardRow) }),
});

/** Uma linha da consulta de prêmios já validada. */
export type WikidataAwardRow = z.output<typeof AwardRow>;
