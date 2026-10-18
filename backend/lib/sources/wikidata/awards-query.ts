/** Propriedade do Wikidata com o id do TMDb: P4947 para filmes, P4985 para pessoas. */
export type TmdbIdProperty = 'P4947' | 'P4985';

/**
 * Monta a consulta SPARQL de prêmios de um lote: os itens com esses ids do TMDb e, para cada um,
 * os prêmios recebidos (P166) e as indicações (P1411) no próprio item, mais o sentido inverso, em
 * que o item do prêmio ou da cerimônia aponta para o filme ou a pessoa como vencedor (P1346) ou
 * indicado (P2453). Qualificadores: ano (P585), categoria no sentido inverso (P642) e obra (P1686).
 * Rótulos em pt-br, pt e en, nessa ordem. Com `withArticle`, traz também o artigo na Wikipedia em
 * inglês (para as categorias da Framboesa de Ouro).
 *
 * @param tmdbIds - Ids do TMDb do lote.
 * @param property - P4947 (filmes) ou P4985 (pessoas).
 * @param withArticle - Se traz o artigo na Wikipedia em inglês.
 * @returns O texto da consulta.
 */
function buildAwardsQuery(tmdbIds: number[], property: TmdbIdProperty, withArticle: boolean): string {
  const values = tmdbIds.map((id) => `"${Math.trunc(id)}"`).join(' ');
  const article = withArticle
    ? 'OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }'
    : '';
  return `SELECT ?tmdb ?kind ?awardLabel ?catLabel ?forLabel ?year ?article WHERE {
  VALUES ?tmdb { ${values} }
  ?item wdt:${property} ?tmdb .
  ${article}
  OPTIONAL {
    { ?item p:P166 ?st . ?st ps:P166 ?award . BIND("win" AS ?kind) }
    UNION { ?item p:P1411 ?st . ?st ps:P1411 ?award . BIND("nom" AS ?kind) }
    UNION { ?award p:P1346 ?st . ?st ps:P1346 ?item . BIND("win" AS ?kind) }
    UNION { ?award p:P2453 ?st . ?st ps:P2453 ?item . BIND("nom" AS ?kind) }
    OPTIONAL { ?st pq:P585 ?date . }
    OPTIONAL { ?st pq:P642 ?cat . }
    OPTIONAL { ?st pq:P1686 ?for . }
  }
  BIND(YEAR(?date) AS ?year)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "pt-br,pt,en". }
}`;
}

export { buildAwardsQuery };
