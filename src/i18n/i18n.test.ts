import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import AsyncStorage from '@react-native-async-storage/async-storage';
import ts from 'typescript';

import ca from './ca.json';
import en from './en.json';
import {
  getLocale,
  getLocalePreference,
  joinList,
  loadLocalePreference,
  lowerInSentence,
  resolveDeviceLocale,
  setLocalePreference,
  t,
} from './index';

const ROOT = join(__dirname, '..', '..');

/** Todas las claves escritas como `t('…')` o `tk('…')` en el código de la app. */
function sourceKeys(): Set<string> {
  const files = execSync('git ls-files -co --exclude-standard src', { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\./.test(file));
  const keys = new Set<string>();
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      readFileSync(join(ROOT, file), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        (node.expression.text === 't' || node.expression.text === 'tk') &&
        node.arguments[0] &&
        ts.isStringLiteralLike(node.arguments[0])
      ) {
        keys.add(node.arguments[0].text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return keys;
}

const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

describe('diccionarios', () => {
  const keys = sourceKeys();

  it('encuentra las claves del código', () => {
    expect(keys.has('Registrarse')).toBe(true);
    expect(keys.has('de enero')).toBe(true);
  });

  it.each([
    ['en', en as Record<string, string>],
    ['ca', ca as Record<string, string>],
  ])('%s traduce todas las claves, sin sobrantes y con las mismas variables', (_, dictionary) => {
    expect([...keys].filter((key) => !(key in dictionary))).toEqual([]);
    expect(Object.keys(dictionary).filter((key) => !keys.has(key))).toEqual([]);
    expect(
      Object.entries(dictionary).filter(
        ([key, text]) => placeholders(key).join() !== placeholders(text).join()
      )
    ).toEqual([]);
  });
});

describe('idioma', () => {
  afterEach(async () => {
    await setLocalePreference('auto');
  });

  it('coge el primer idioma del móvil que tenemos y, si no hay, inglés', () => {
    expect(resolveDeviceLocale(['ca', 'es'])).toBe('ca');
    expect(resolveDeviceLocale(['fr', 'es', 'en'])).toBe('es');
    expect(resolveDeviceLocale(['EN'])).toBe('en');
    expect(resolveDeviceLocale(['fr', null])).toBe('en');
  });

  it('traduce y sustituye variables', async () => {
    expect(t('Paso {step} de {total}', { step: 1, total: 3 })).toBe('Paso 1 de 3');
    await setLocalePreference('en');
    expect(t('Paso {step} de {total}', { step: 1, total: 3 })).toBe('Step 1 of 3');
    await setLocalePreference('ca');
    expect(t('Paso {step} de {total}', { step: 1, total: 3 })).toBe('Pas 1 de 3');
  });

  it('un texto sin traducción, como una pregunta antigua guardada, queda como está', async () => {
    await setLocalePreference('en');
    expect(t('Una pregunta que ya no está en el catálogo')).toBe(
      'Una pregunta que ya no está en el catálogo'
    );
  });

  it('une listas y respeta las mayúsculas de cada idioma', async () => {
    expect(joinList(['a', 'b', 'c'])).toBe('a, b y c');
    expect(lowerInSentence('Inglés')).toBe('inglés');
    await setLocalePreference('en');
    expect(joinList(['a', 'b'])).toBe('a and b');
    expect(lowerInSentence('English')).toBe('English');
    await setLocalePreference('ca');
    expect(joinList(['a', 'b'])).toBe('a i b');
  });

  it('guarda la elección, la recupera al arrancar y «Automático» la olvida', async () => {
    await setLocalePreference('ca');
    expect(await AsyncStorage.getItem('cofounder.locale')).toBe('ca');

    await setLocalePreference('auto');
    expect(await AsyncStorage.getItem('cofounder.locale')).toBeNull();
    expect(getLocale()).toBe('es');

    await AsyncStorage.setItem('cofounder.locale', 'en');
    await loadLocalePreference();
    expect(getLocale()).toBe('en');
    expect(getLocalePreference()).toBe('en');
  });

  it('ignora un valor guardado que no reconoce', async () => {
    await AsyncStorage.setItem('cofounder.locale', 'xx');
    await loadLocalePreference();
    expect(getLocale()).toBe('es');
  });
});
