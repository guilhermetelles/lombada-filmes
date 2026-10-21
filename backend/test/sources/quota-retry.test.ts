import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { nextPacificMidnight, quotaRetryAt } from '../../lib/sources/gemini/quota-retry.js';

/** Momento dos testes: 22:08 UTC de 18/10/2026, quando o 3.8 Flash respondeu 429 de verdade. */
const NOW = new Date('2026-10-18T22:08:00Z');

/**
 * Erro com o formato do APIError do SDK: mensagem, corpo e cabeçalhos.
 *
 * @param message - Mensagem do erro.
 * @param body - Corpo da resposta.
 * @param headers - Cabeçalhos da resposta.
 * @returns O erro.
 */
function apiError(message: string, body: unknown = {}, headers: Record<string, string> = {}): Error {
  return Object.assign(new Error(message), { status: 429, error: body, headers: new Headers(headers) });
}

/**
 * Espera calculada, em segundos.
 *
 * @param cause - Erro do SDK.
 * @returns Segundos entre NOW e o momento devolvido.
 */
const waitSeconds = (cause: unknown) => (quotaRetryAt(cause, NOW).getTime() - NOW.getTime()) / 1000;

describe('quotaRetryAt', () => {
  test('usa o retry-after em segundos', () => {
    assert.equal(waitSeconds(apiError('429', {}, { 'retry-after': '42' })), 42);
  });

  test('usa o retryDelay do RetryInfo no corpo', () => {
    const body = { error: { details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '34.5s' }] } };
    assert.equal(waitSeconds(apiError('429', body)), 34.5);
  });

  test('lê o "Please retry in" da mensagem, inclusive sem a última unidade', () => {
    assert.equal(waitSeconds(apiError('limit: 20 requests per day. Please retry in 1h51m12s')), 6672);
    assert.equal(waitSeconds(apiError('limit: 20 requests per day on Free Tier. Please retry in 1h51')), 6660);
    assert.equal(waitSeconds(apiError('Please retry in 12.5s.')), 12.5);
  });

  test('sem prazo: cota diária até a meia-noite do Pacífico; outro limite, um minuto', () => {
    assert.equal(
      quotaRetryAt(
        apiError('quota exceeded', {
          error: { details: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] },
        }),
        NOW,
      ).toISOString(),
      '2026-10-19T07:00:00.000Z',
    );
    assert.equal(waitSeconds(apiError('Your project has exceeded a quota.')), 60);
  });

  test('prazo absurdo (mais de 26 h) é ignorado', () => {
    assert.equal(waitSeconds(apiError('Your project has exceeded a quota.', {}, { 'retry-after': '999999' })), 60);
  });
});

describe('nextPacificMidnight', () => {
  test('acompanha o horário de verão dos EUA', () => {
    assert.equal(nextPacificMidnight(new Date('2026-10-18T22:08:00Z')).toISOString(), '2026-10-19T07:00:00.000Z');
    assert.equal(nextPacificMidnight(new Date('2026-12-01T12:00:00Z')).toISOString(), '2026-12-02T08:00:00.000Z');
    // 06:30 UTC de 19/10 ainda é 18/10 no Pacífico.
    assert.equal(nextPacificMidnight(new Date('2026-10-19T06:30:00Z')).toISOString(), '2026-10-19T07:00:00.000Z');
  });
});
