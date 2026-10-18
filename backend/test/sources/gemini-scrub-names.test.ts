import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { scrubNames } from '../../lib/sources/gemini/scrub-names.js';

describe('scrubNames', () => {
  test('troca nomes inteiros, sem diferença de maiúsculas e acentos', () => {
    assert.equal(
      scrubNames('A Ana amou, a ANA chorou e a Aná riu', ['Ana']),
      'A [nome] amou, a [nome] chorou e a [nome] riu',
    );
  });

  test('não mexe em pedaços de outras palavras', () => {
    assert.equal(scrubNames('banana e Anabela', ['Ana']), 'banana e Anabela');
  });

  test('nome composto sai inteiro, e cada parte também', () => {
    assert.equal(
      scrubNames('Maria Clara gostou; Clara não, Maria sim', ['Maria Clara']),
      '[nome] gostou; [nome] não, [nome] sim',
    );
  });

  test('preserva o resto do texto, acentos e emojis incluídos', () => {
    assert.equal(scrubNames('Péssimo 😂, disse Joana à Bia.', ['joana', 'Bia']), 'Péssimo 😂, disse [nome] à [nome].');
  });

  test('sem nomes (ou só vazios e de uma letra), devolve o texto igual', () => {
    assert.equal(scrubNames('o filme é ruim', []), 'o filme é ruim');
    assert.equal(scrubNames('o filme é ruim', ['', ' ', 'o']), 'o filme é ruim');
  });

  test('caracteres especiais no nome valem literalmente', () => {
    assert.equal(scrubNames('a Lu (com C.) viu e a Lu.C também', ['Lu.C']), 'a Lu (com C.) viu e a [nome] também');
  });
});
