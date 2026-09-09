import { test } from 'node:test';
import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compareFingerprints, parseFingerprint } from './schema-compare.mjs';

function fingerprint(lines) {
  lines.sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  return `digest   ${createHash('md5').update(lines.join('\n')).digest('hex')}\n${lines.join('\n')}\n`;
}

test('igualdad, incluso con transporte CRLF', () => {
  const value = fingerprint(['table    profiles rls=t', 'policy   profiles.lectura using=true']);
  assert.equal(compareFingerprints(value, value.replaceAll('\n', '\r\n')), '');
});

test('rechaza salida vacía, truncada, digest falso y orden no canónico', () => {
  const value = fingerprint(['column   profiles.name text', 'table    profiles rls=t']);
  for (const invalid of [
    '',
    value.slice(0, -15),
    value.replace('text', 'uuid'),
    value.split('\n').slice(0, -1).reverse().join('\n'),
  ]) {
    assert.throws(() => parseFingerprint(invalid));
  }
});

for (const kind of ['column', 'index', 'policy', 'func', 'grantfn']) {
  test(`diff legible detecta cambio de ${kind}`, () => {
    const diff = compareFingerprints(
      fingerprint([`${kind}    antes`]),
      fingerprint([`${kind}    despues`])
    );
    assert.match(diff, new RegExp(`- ${kind}    antes`));
    assert.match(diff, new RegExp(`\\+ ${kind}    despues`));
  });
}

test('objetos sobrantes y duplicados no desaparecen al comparar', () => {
  const line = 'func     public.dev_reset_current_user()';
  assert.match(compareFingerprints(fingerprint([line]), fingerprint([line, line])), /\+ func/);
});
