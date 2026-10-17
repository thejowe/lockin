/**
 * Lo que el alta recoge antes de que exista el perfil.
 *
 * Desde el 2026-10-17 el alta empieza por «Sobre ti» (nombre, edad y de dónde
 * eres) y solo después pide la cuenta. Esos tres datos no se pueden guardar en
 * el perfil todavía —no hay perfil hasta el formulario largo—, así que esperan
 * aquí y el formulario arranca con ellos rellenos. Van a `AsyncStorage` y no a
 * memoria porque entre medias está confirmar el correo: la persona sale al
 * cliente de correo y el sistema puede matar la app.
 *
 * Se borran al crear el perfil (`clearSignupBasics`): a partir de ahí la fuente
 * de verdad es el perfil, y un borrador viejo prerrellenaría el alta de otra
 * cuenta en este mismo teléfono.
 *
 * Un fallo al leer o escribir no rompe el alta: el formulario largo vuelve a
 * pedir los tres campos, así que lo peor es teclearlos otra vez.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cofounder.signup.basics';

export interface SignupBasics {
  name: string;
  age: number;
  location: string;
}

function isBasics(value: unknown): value is SignupBasics {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.age === 'number' &&
    typeof candidate.location === 'string'
  );
}

export async function readSignupBasics(): Promise<SignupBasics | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isBasics(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveSignupBasics(basics: SignupBasics): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(basics));
  } catch {
    // Ver la cabecera: sin borrador, el formulario largo los vuelve a pedir.
  }
}

export async function clearSignupBasics(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Un borrador que sobrevive solo prerrellena; no publica nada.
  }
}
