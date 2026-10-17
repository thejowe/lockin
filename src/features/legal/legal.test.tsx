/**
 * Documentos legales dentro de la app.
 *
 * Lo que no puede fallar en silencio: que el texto empaquetado sea el de
 * `docs/tiendas/*.md` (el que publica la web y se acepta en el alta), que el
 * Markdown se lea entero, y que ningún enlace saque de la app al navegador
 * del sistema.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { fireEvent, render, screen } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';

import { LegalDocument, isLegalDocKey, legalDocForUrl } from './legal-document';
import { parseInline, parseMarkdown } from './markdown';
import { LEGAL_TEXTS } from './texts.generated';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(() => Promise.resolve()) }));

describe('texts.generated.ts', () => {
  it('está al día con docs/tiendas/*.md (lo mismo que publica la web)', () => {
    // `--check` sale con 1 si el generado no es lo que saldría ahora.
    expect(() =>
      execFileSync(process.execPath, [
        join(__dirname, '../../../scripts/build-legal.mjs'),
        '--check',
      ])
    ).not.toThrow();
  });

  it('no enseña notas internas ni lo que va tras la línea `---`', () => {
    for (const text of Object.values(LEGAL_TEXTS)) {
      expect(text).not.toMatch(/^>/m);
      expect(text).not.toMatch(/^---$/m);
    }
  });
});

describe('parseMarkdown', () => {
  it('lee títulos, citas, párrafos y listas con continuación', () => {
    const blocks = parseMarkdown(
      [
        '# Título',
        '',
        '> Nota que',
        '> sigue.',
        '',
        'Un párrafo',
        'en dos líneas.',
        '',
        '## Sección',
        '- uno',
        '  que sigue',
        '- dos',
      ].join('\n')
    );

    expect(blocks.map((block) => block.kind)).toEqual([
      'heading',
      'quote',
      'paragraph',
      'heading',
      'list',
    ]);
    expect(blocks[1]).toEqual({
      kind: 'quote',
      spans: [{ kind: 'text', text: 'Nota que sigue.' }],
    });
    expect(blocks[4]).toEqual({
      kind: 'list',
      items: [[{ kind: 'text', text: 'uno que sigue' }], [{ kind: 'text', text: 'dos' }]],
    });
  });

  it('en línea: negrita, código, enlaces y URLs sueltas', () => {
    expect(parseInline('**Hola** `x` [aquí](https://a.es/b) y https://c.es.')).toEqual([
      { kind: 'bold', text: 'Hola' },
      { kind: 'text', text: ' ' },
      { kind: 'code', text: 'x' },
      { kind: 'text', text: ' ' },
      { kind: 'link', text: 'aquí', url: 'https://a.es/b' },
      { kind: 'text', text: ' y ' },
      { kind: 'link', text: 'https://c.es', url: 'https://c.es' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('ningún documento deja sintaxis sin leer a la vista', () => {
    for (const text of Object.values(LEGAL_TEXTS)) {
      const visible = JSON.stringify(parseMarkdown(text));
      expect(visible).not.toMatch(/\*\*|\]\(|"text":"#/);
    }
  });
});

describe('legalDocForUrl', () => {
  it('reconoce las páginas publicadas y deja fuera el resto', () => {
    expect(legalDocForUrl('https://thejowe.github.io/lockin/normas')).toBe('guidelines');
    expect(legalDocForUrl('https://thejowe.github.io/lockin/privacidad/')).toBe('privacy');
    expect(legalDocForUrl('https://thejowe.github.io/lockin/seguridad-infantil')).toBe(
      'childSafety'
    );
    expect(legalDocForUrl('https://thejowe.github.io/lockin/soporte')).toBeNull();
    expect(legalDocForUrl('https://www.aepd.es')).toBeNull();
  });
});

describe('isLegalDocKey', () => {
  it('solo acepta los cuatro documentos, no lo que hereda cualquier objeto', () => {
    expect(isLegalDocKey('terms')).toBe(true);
    expect(isLegalDocKey('childSafety')).toBe(true);
    for (const value of ['constructor', 'toString', '__proto__', 'otra', undefined]) {
      expect(isLegalDocKey(value)).toBe(false);
    }
  });
});

describe('LegalDocument', () => {
  beforeEach(() => jest.clearAllMocks());

  it('pinta el documento con su título', async () => {
    await render(<LegalDocument doc="terms" onOpenDocument={jest.fn()} />);

    expect(screen.getByRole('header', { name: 'Términos de uso de cofounder' })).toBeTruthy();
  });

  it('un enlace a otro documento legal se abre dentro, sin navegador', async () => {
    const onOpenDocument = jest.fn();
    await render(<LegalDocument doc="terms" onOpenDocument={onOpenDocument} />);

    await fireEvent.press(screen.getAllByText('normas de la comunidad')[0]);

    expect(onOpenDocument).toHaveBeenCalledWith('guidelines');
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });

  it('un enlace de fuera va al navegador integrado, no al del sistema', async () => {
    await render(<LegalDocument doc="privacy" onOpenDocument={jest.fn()} />);

    await fireEvent.press(screen.getAllByText(/aepd\.es/)[0]);

    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://www.aepd.es');
  });
});
