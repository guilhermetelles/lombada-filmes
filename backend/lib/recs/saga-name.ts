/** "Coleção"/"Collection" no fim do nome da saga, com ou sem separador ("Alien - Coleção", "Alien Collection"). */
const COLLECTION_SUFFIX = /\s*(?:[-–—:]\s*)?(?:coleção|colecção|collection)$/iu;

/** "Coleção" no começo do nome da saga ("Coleção Harry Potter", "Coleção de Shrek"). */
const COLLECTION_PREFIX = /^(?:coleção|collection)(?:\s+(?:de|do|da|dos|das))?\s+/iu;

/**
 * Nome da saga para o texto: sem "Coleção"/"Collection" que o TMDb põe no nome da coleção. Se
 * sobrar texto vazio, fica o nome como veio.
 *
 * @param name - Nome da coleção no TMDb.
 * @returns O nome da saga.
 */
function sagaName(name: string): string {
  const trimmed = name.trim().replace(COLLECTION_SUFFIX, '').replace(COLLECTION_PREFIX, '').trim();
  return trimmed || name.trim();
}

export { sagaName };
