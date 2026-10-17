import { SourceUnavailableError } from '../../errors/app-errors.js';
import { BechdelPageFields } from '../../schemas/sources/bechdel.js';
import { parseSourceData } from '../shared/fetch-json.js';

/** `<link rel="canonical" href="…">`; o grupo 1 é o endereço, ainda com entidades HTML. */
const CANONICAL = /<link rel="canonical" href="([^"]+)"/;
/** Link para a página do filme no IMDb; o grupo 1 é o id. */
const IMDB_LINK = /imdb\.com\/title\/(tt\d+)/;
/** "This movie passed 3 of 3 tests (although dubious)."; grupo 1: critérios, grupo 2: duvidosa. */
const PASSED_TESTS = /This movie passed (\d) of 3 tests( \(although dubious\))?/;
/** Cabeçalho de um comentário que contesta a avaliação ("<b>nome</b> disagreed with the rating"). */
const DISPUTE = /<\/b> disagreed with the rating/g;
/** Entidades HTML que aparecem nos endereços do site (&amp;, &#x27;, &#39;, &quot;…). */
const HTML_ENTITY = /&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|apos));/gi;
/** Entidades nomeadas que o site usa. */
const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/**
 * Lê o endereço canônico de uma página do site, com as entidades HTML desfeitas. A página
 * `/view/{id}/` é só um redirecionamento, e o endereço final está aqui.
 *
 * @param html - Página do site.
 * @returns O endereço como está no `href` (relativo ou absoluto), já sem entidades.
 * @throws {SourceUnavailableError} Se a página não tiver o link canônico.
 */
export function readCanonical(html: string): string {
  const href = CANONICAL.exec(html)?.[1];
  if (href === undefined) throw new SourceUnavailableError('bechdel', 'página sem link canônico');
  return decodeHtmlEntities(href);
}

/**
 * Lê da página final de um filme o id do IMDb, os critérios, se é duvidosa e as contestações.
 *
 * @param html - Página do filme.
 * @returns Os campos conferidos.
 * @throws {SourceUnavailableError} Se a página não trouxer a avaliação ou ela estiver fora do formato.
 */
export function readBechdelPage(html: string): BechdelPageFields {
  const passed = PASSED_TESTS.exec(html);
  if (!passed) throw new SourceUnavailableError('bechdel', 'página sem a avaliação');

  return parseSourceData(
    BechdelPageFields,
    {
      imdbId: IMDB_LINK.exec(html)?.[1] ?? null,
      rating: passed[1],
      dubious: passed[2] !== undefined,
      disputes: html.match(DISPUTE)?.length ?? 0,
    },
    'bechdel',
  );
}

/**
 * Codifica um caminho para guardar como endereço: cada trecho em percent-encoding, inclusive
 * `'`, `!`, `(` e `)`, mantendo `/` e `:` (o mesmo que o site e o mock usam).
 *
 * @param path - Caminho já sem entidades HTML, como "/view/2198/a_bug's_life/".
 * @returns O caminho codificado, como "/view/2198/a_bug%27s_life/".
 */
export function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) =>
      encodeURIComponent(segment)
        .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
        .replace(/%3A/g, ':'),
    )
    .join('/');
}

/**
 * Desfaz as entidades HTML de um texto.
 *
 * @param text - Texto com entidades, como "a_bug&#x27;s_life".
 * @returns O texto com os caracteres no lugar das entidades.
 */
function decodeHtmlEntities(text: string): string {
  return text.replace(HTML_ENTITY, (entity, decimal?: string, hex?: string, name?: string) => {
    if (decimal !== undefined) return String.fromCodePoint(Number(decimal));
    if (hex !== undefined) return String.fromCodePoint(Number.parseInt(hex, 16));
    return NAMED_ENTITIES[name?.toLowerCase() ?? ''] ?? entity;
  });
}
