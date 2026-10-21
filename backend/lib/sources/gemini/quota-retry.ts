/** Espera quando o 429 não diz quanto: o limite por minuto passa em até um minuto. */
const MINUTE_LIMIT_WAIT_MS = 60_000;

/** Espera máxima aceita de um 429; acima disso, algo veio errado e vale a meia-noite do Pacífico. */
const MAX_WAIT_MS = 26 * 60 * 60 * 1000;

/** Fuso em que o Google zera a cota diária (RPD) do Gemini, segundo a documentação de limites. */
const QUOTA_TIME_ZONE = 'America/Los_Angeles';

/** Unidades do texto "Please retry in 1h51m12.5s", em milissegundos. */
const UNIT_MS: Record<string, number> = { h: 3_600_000, m: 60_000, s: 1_000, ms: 1 };

/**
 * Diz até quando um modelo do Gemini que respondeu 429 deve ser pulado. Usa, na ordem, o cabeçalho
 * `retry-after`, o `retryDelay` do RetryInfo no corpo do erro e o "Please retry in …" da mensagem.
 * Sem nenhum deles, um limite "per day" vale até a próxima meia-noite do Pacífico (quando a cota
 * diária zera) e qualquer outro, por um minuto.
 *
 * @param cause - Erro do SDK (com `headers`, `error` e `message`, quando houve resposta).
 * @param now - Momento do 429.
 * @returns O momento a partir do qual o modelo pode ser tentado de novo.
 */
export function quotaRetryAt(cause: unknown, now: Date): Date {
  const wait = retryAfterHeader(cause, now) ?? retryDelayInBody(cause) ?? retryInMessage(cause);
  if (wait !== undefined && wait > 0 && wait <= MAX_WAIT_MS) return new Date(now.getTime() + wait);
  return isDailyLimit(cause) ? nextPacificMidnight(now) : new Date(now.getTime() + MINUTE_LIMIT_WAIT_MS);
}

/**
 * Próxima meia-noite no fuso do Pacífico, contando o horário de verão do dia.
 *
 * @param now - Momento de referência.
 * @returns A meia-noite seguinte em America/Los_Angeles.
 */
export function nextPacificMidnight(now: Date): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: QUOTA_TIME_ZONE,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      timeZoneName: 'longOffset',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  // "GMT-07:00" vira -7 h; o dia seguinte começa à meia-noite local, ou seja, 7 h depois em UTC.
  const offset = /GMT([+-])(\d{2}):(\d{2})/.exec(parts.timeZoneName ?? '');
  const offsetMs = offset
    ? (offset[1] === '-' ? -1 : 1) * (Number(offset[2]) * 3_600_000 + Number(offset[3]) * 60_000)
    : 0;
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1) - offsetMs);
}

/**
 * Lê o cabeçalho `retry-after` (segundos ou data HTTP).
 *
 * @param cause - Erro do SDK.
 * @param now - Momento do 429, para a forma em data.
 * @returns A espera em milissegundos, ou undefined sem o cabeçalho.
 */
function retryAfterHeader(cause: unknown, now: Date): number | undefined {
  const headers = cause instanceof Error && 'headers' in cause ? cause.headers : undefined;
  const value = headers instanceof Headers ? headers.get('retry-after') : null;
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : at - now.getTime();
}

/**
 * Procura no corpo do erro o `retryDelay` do google.rpc.RetryInfo (ex.: "6711s" ou "34.5s").
 *
 * @param cause - Erro do SDK.
 * @returns A espera em milissegundos, ou undefined sem o campo.
 */
function retryDelayInBody(cause: unknown): number | undefined {
  const body = cause instanceof Error && 'error' in cause ? cause.error : undefined;
  const delay = findKey(body, 'retryDelay');
  const match = typeof delay === 'string' ? /^(\d+(?:\.\d+)?)s$/.exec(delay.trim()) : null;
  return match ? Number(match[1]) * 1000 : undefined;
}

/**
 * Lê o "retry in 1h51m12s" (ou "34.5s", ou "1h51") da mensagem.
 *
 * @param cause - Erro do SDK.
 * @returns A espera em milissegundos, ou undefined sem esse trecho.
 */
function retryInMessage(cause: unknown): number | undefined {
  const message = cause instanceof Error ? cause.message : '';
  const text = /retry in ((?:\d+(?:\.\d+)?\s*(?:ms|h|m|s)?\s*)+)/i.exec(message)?.[1];
  if (!text) return undefined;
  const pieces = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(ms|h|m|s)?/g)];
  // "1h51" sem a última unidade: o número solto vale a unidade seguinte à anterior (h → m → s).
  const next: Record<string, string> = { h: 'm', m: 's', s: 'ms' };
  let previous = 's';
  let total = 0;
  for (const [, amount, unit] of pieces) {
    const used = unit ?? next[previous] ?? 's';
    total += Number(amount) * (UNIT_MS[used] ?? 1000);
    previous = used;
  }
  return total;
}

/**
 * Diz se o 429 é da cota diária: o texto ou o quotaId falam em dia.
 *
 * @param cause - Erro do SDK.
 * @returns true para "per day" ou "PerDay".
 */
function isDailyLimit(cause: unknown): boolean {
  const message = cause instanceof Error ? cause.message : '';
  const body = cause instanceof Error && 'error' in cause ? JSON.stringify(cause.error ?? '') : '';
  return /per\s*day|perday/i.test(`${message} ${body}`);
}

/**
 * Procura uma chave em qualquer nível de um objeto ou lista.
 *
 * @param value - Onde procurar.
 * @param key - Chave procurada.
 * @returns O primeiro valor encontrado, ou undefined.
 */
function findKey(value: unknown, key: string): unknown {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findKey(item, key);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (typeof value !== 'object' || value === null) return undefined;
  if (key in value) return (value as Record<string, unknown>)[key];
  return findKey(Object.values(value), key);
}
