import { SourceUnavailableError } from '../../errors/app-errors.js';
import { FilmJsonLd } from '../../schemas/sources/letterboxd.js';
import { parseSourceData } from '../shared/fetch-json.js';

/** Bloco `<script type="application/ld+json">` da página; o grupo 1 é o conteúdo. */
const JSON_LD_BLOCK = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/;
/** Comentários CDATA que envolvem o bloco e precisam sair antes do JSON.parse. */
const CDATA_COMMENTS = /\/\*\s*<!\[CDATA\[\s*\*\/|\/\*\s*\]\]>\s*\*\//g;

/**
 * Lê o bloco JSON-LD (schema.org/Movie) da página de um filme do Letterboxd.
 *
 * @param html - Página do filme.
 * @returns Endereço da página e nota agregada, quando houver.
 * @throws {SourceUnavailableError} Se a página não tiver o bloco (quase sempre o desafio do Cloudflare), ou ele for inválido.
 */
function readFilmJsonLd(html: string): FilmJsonLd {
  const block = JSON_LD_BLOCK.exec(html)?.[1];
  // Sem o bloco, quase sempre é a página de desafio do Cloudflare.
  if (block === undefined) throw new SourceUnavailableError('letterboxd', 'página sem JSON-LD (possível bloqueio)');

  let json: unknown;
  try {
    json = JSON.parse(block.replace(CDATA_COMMENTS, '').trim());
  } catch (cause) {
    throw new SourceUnavailableError('letterboxd', 'JSON-LD inválido', { cause });
  }
  return parseSourceData(FilmJsonLd, json, 'letterboxd');
}

export { readFilmJsonLd };
