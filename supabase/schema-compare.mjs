import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

// SQL ordena con COLLATE "C"; comparar bytes UTF-8 también fuera de Linux.
const byteOrder = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));

export function parseFingerprint(text) {
  const lines = text.replace(/\r\n/g, '\n').trimEnd().split('\n');
  const digest = /^digest   ([a-f0-9]{32})$/.exec(lines.shift() ?? '');
  assert(digest, 'Falta el digest: salida SQL vacía, truncada o inválida');
  assert(
    lines.length > 0 &&
      lines.every((line) =>
        /^(table|column|constr|index|enum|func|trigger|policy|grant|grantfn|publish)\s+\S/.test(
          line
        )
      ),
    'Líneas de huella inválidas'
  );
  assert.deepEqual(lines, [...lines].sort(byteOrder), 'La huella no está ordenada con COLLATE C');
  assert.equal(
    createHash('md5').update(lines.join('\n')).digest('hex'),
    digest[1],
    'Digest no corresponde a las líneas recibidas'
  );
  return lines;
}

export function compareFingerprints(expected, actual) {
  const left = parseFingerprint(expected);
  const right = parseFingerprint(actual);
  // Multiconjunto: conservar incluso diferencias en líneas duplicadas.
  const remaining = [...right];
  const removed = [];
  for (const line of left) {
    const index = remaining.indexOf(line);
    if (index < 0) removed.push(`- ${line}`);
    else remaining.splice(index, 1);
  }
  const diff = [...removed, ...remaining.map((line) => `+ ${line}`)];
  return diff.length ? ['--- esperado: migrations/', '+++ observado', ...diff, ''].join('\n') : '';
}
