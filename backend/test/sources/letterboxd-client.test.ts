import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SourceUnavailableError } from '../../lib/errors/app-errors.js';
import { createLetterboxdClient } from '../../lib/sources/letterboxd/letterboxd-client.js';
import type { Fetch } from '../../lib/types/sources.js';
import { fakeSources, respondWith } from '../support/fake-sources.js';

const letterboxdClient = (fetch: Fetch = fakeSources().fetch) => createLetterboxdClient({ fetch });
const pageWithJsonLd = (jsonLd: object) => `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;

describe('Letterboxd: getRating', () => {
  test('nota, número de notas e endereço do filme', async () => {
    const rating = await letterboxdClient().getRating(2756);

    assert.equal(rating.value, 3.72);
    assert.ok((rating.count ?? 0) > 100_000);
    assert.equal(rating.url, 'https://letterboxd.com/film/the-abyss/');
  });

  test('filme ainda sem notas suficientes: nota null', async () => {
    const page = pageWithJsonLd({ url: 'https://letterboxd.com/film/x/' });
    const rating = await letterboxdClient(respondWith(page)).getRating(1);

    assert.deepEqual(rating, { value: null, count: null, url: 'https://letterboxd.com/film/x/' });
  });

  test('filme que o Letterboxd não tem (404): nota e endereço null, sem erro', async () => {
    const rating = await letterboxdClient(respondWith('não encontrado', { status: 404 })).getRating(1);
    assert.deepEqual(rating, { value: null, count: null, url: null });
  });

  test('página sem JSON-LD (bloqueio do Cloudflare): SourceUnavailableError', async () => {
    const challenge = respondWith('<html>Just a moment...</html>');
    await assert.rejects(letterboxdClient(challenge).getRating(2756), SourceUnavailableError);
  });

  test('JSON-LD inválido: SourceUnavailableError', async () => {
    const broken = respondWith('<script type="application/ld+json">{ não é json</script>');
    await assert.rejects(letterboxdClient(broken).getRating(2756), SourceUnavailableError);
  });
});
