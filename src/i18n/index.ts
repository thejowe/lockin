/**
 * Idiomas de la app.
 *
 * La clave de cada texto es el propio texto en español: `t('Registrarse')`. Así
 * el código se sigue leyendo igual, el español no necesita diccionario y lo que
 * se escribe en `en.json` y `ca.json` se traduce frase a frase.
 * `i18n.test.ts` recorre `src/` y falla si a alguna clave le falta traducción.
 *
 * `t()` se resuelve al llamarla, así que nada que quede evaluado al importar un
 * módulo puede usarla: una tabla de módulo usa getters y una constante suelta,
 * `tk()`, para traducirla luego con `t()` donde se pinta.
 *
 * Al cambiar de idioma, `_layout.tsx` vuelve a montar la navegación, y por eso
 * las pantallas pueden llamar a `t()` sin suscribirse a nada.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';

import ca from './ca.json';
import en from './en.json';

export type AppLocale = 'es' | 'en' | 'ca';

/** Lo que elige la persona en Ajustes: un idioma, o seguir al del móvil. */
export type LocalePreference = AppLocale | 'auto';

export const APP_LOCALES: readonly AppLocale[] = ['es', 'en', 'ca'];

/** Si el móvil no pide ninguno de los nuestros. */
const FALLBACK_LOCALE: AppLocale = 'en';

const STORAGE_KEY = 'cofounder.locale';

/** Locale para `Intl` y `toLocaleDateString`. */
const INTL_LOCALES: Record<AppLocale, string> = { es: 'es-ES', en: 'en-GB', ca: 'ca-ES' };

const DICTIONARIES: Record<AppLocale, Record<string, string> | null> = { es: null, en, ca };

export type TranslationVars = Record<string, string | number>;

/** El primero de los idiomas del móvil que tenemos, en su orden de preferencia. */
export function resolveDeviceLocale(languageCodes: readonly (string | null)[]): AppLocale {
  for (const code of languageCodes) {
    const match = APP_LOCALES.find((locale) => locale === code?.toLowerCase());
    if (match) return match;
  }
  return FALLBACK_LOCALE;
}

function deviceLocale(): AppLocale {
  // Solo la build de los E2E, cuyos flujos buscan textos en español.
  const forced = process.env.EXPO_PUBLIC_FORCE_LOCALE;
  return resolveDeviceLocale([
    forced ?? null,
    ...getLocales().map((locale) => locale.languageCode),
  ]);
}

let preference: LocalePreference = 'auto';
let current: AppLocale = deviceLocale();
const listeners = new Set<() => void>();

function publish(next: AppLocale) {
  if (next === current) return;
  current = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Traduce `key` y sustituye sus `{variables}`. Sin traducción, queda el español. */
export function t(key: string, vars?: TranslationVars): string {
  const text = DICTIONARIES[current]?.[key] ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole
  );
}

/** Marca un texto como traducible sin traducirlo: para constantes de módulo. */
export function tk(key: string): string {
  return key;
}

/**
 * Un texto ya traducido al idioma activo, en todos los idiomas de la app: con
 * la app en inglés, `'Spain'` → `['España', 'Spain', 'Espanya']`.
 */
export function sameTextInAllLocales(text: string): string[] {
  const dictionary = DICTIONARIES[current];
  const key = dictionary
    ? (Object.keys(dictionary).find((candidate) => dictionary[candidate] === text) ?? text)
    : text;
  return APP_LOCALES.map((locale) => DICTIONARIES[locale]?.[key] ?? key);
}

export function getLocale(): AppLocale {
  return current;
}

export function getIntlLocale(): string {
  return INTL_LOCALES[current];
}

export function getLocalePreference(): LocalePreference {
  return preference;
}

/** «A, B y C» con la conjunción de cada idioma. */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return t('{list} y {last}', {
    list: items.slice(0, -1).join(', '),
    last: items[items.length - 1],
  });
}

/**
 * Una etiqueta dentro de una frase. En inglés no se pasa a minúsculas: los
 * idiomas llevan mayúscula («Spanish and English»).
 */
export function lowerInSentence(label: string): string {
  return current === 'en' ? label : label.toLowerCase();
}

/** Lee la elección guardada. Se llama una vez, antes de pintar nada. */
export async function loadLocalePreference(): Promise<void> {
  let stored: string | null = null;
  try {
    stored = await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    // Sin almacenamiento se sigue con el idioma del móvil.
  }
  if (stored && (APP_LOCALES as readonly string[]).includes(stored)) {
    preference = stored as AppLocale;
    publish(preference);
  }
}

/** Guarda la elección de Ajustes y la aplica. */
export async function setLocalePreference(next: LocalePreference): Promise<void> {
  preference = next;
  publish(next === 'auto' ? deviceLocale() : next);
  try {
    if (next === 'auto') await AsyncStorage.removeItem(STORAGE_KEY);
    else await AsyncStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Vale para esta sesión aunque no se haya podido guardar.
  }
}

/** Android no reinicia la app al cambiar el idioma del móvil: se relee al volver. */
export function refreshDeviceLocale(): void {
  if (preference === 'auto') publish(deviceLocale());
}

export function useLocale(): AppLocale {
  return useSyncExternalStore(subscribe, getLocale, getLocale);
}
