/** Log estruturado: uma linha JSON por evento, que o painel da Vercel indexa e filtra por campo. */

/** Nível do evento no log. */
type Level = 'info' | 'warn' | 'error';
/** Campos extras de um evento. */
type Fields = Record<string, unknown>;

/** Saída de cada nível (a Vercel separa stdout de stderr). */
const WRITERS: Record<Level, (line: string) => void> = {
  info: console.log,
  warn: console.warn,
  error: console.error,
};

/**
 * Replacer do JSON.stringify que mantém nome, mensagem e pilha de um Error (sem ele, vira {}).
 *
 * @param _key - Chave do valor (não usada).
 * @param value - Valor sendo serializado.
 * @returns O Error como objeto simples, ou o próprio valor.
 */
function serializeErrors(_key: string, value: unknown): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  return value;
}

/**
 * Escreve um evento numa linha JSON.
 *
 * @param level - Nível do evento.
 * @param message - Descrição curta do que aconteceu.
 * @param fields - Campos extras, que o painel da Vercel indexa.
 */
function write(level: Level, message: string, fields: Fields): void {
  WRITERS[level](JSON.stringify({ level, message, ...fields }, serializeErrors));
}

/** Log estruturado do backend: `logger.warn(mensagem, { campos })`. */
export const logger = {
  info: (message: string, fields: Fields = {}) => write('info', message, fields),
  warn: (message: string, fields: Fields = {}) => write('warn', message, fields),
  error: (message: string, fields: Fields = {}) => write('error', message, fields),
};
