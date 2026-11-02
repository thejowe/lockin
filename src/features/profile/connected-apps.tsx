/**
 * Las apps que una persona tiene conectadas, como una fila de logos que llevan
 * a su cuenta (decisión del usuario del 2026-10-17). Sustituye a la lista de
 * enlaces en texto de la ficha: GitHub, LinkedIn, Instagram, TikTok y su web.
 *
 * - Solo sale un logo si hay enlace, y solo si es `http(s)://`: el formulario
 *   ya lo exige, pero la ficha ajena la pinta desde el servidor y un
 *   `javascript:` o un esquema raro no se abre desde aquí.
 * - Se abre con `Linking.openURL`: con Instagram o TikTok instalados, el
 *   sistema lleva a su app, que es lo que se espera al tocar su logo.
 * - Los logos son dibujos propios y sencillos. Desde el 2026-10-30 van en el
 *   color de cada app (decisión del usuario, `brand` en `Glyph`); GitHub y la
 *   web no tienen color propio y siguen en la tinta.
 * - Instagram y TikTok llevan además `@usuario` al lado del logo (2026-10-30,
 *   decisión del usuario), sacado del propio enlace. Si el enlace no deja ver
 *   el usuario (una publicación suelta, un enlace acortado), solo el logo.
 */

import { useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Control, HitSlop, Opacity, Radii, Spacing, Stroke } from '@/constants/theme';
import { OBJECTIONABLE_MESSAGE, isObjectionable } from '@/features/safety/content-filter';
import { useTheme } from '@/hooks/use-theme';

import { CompactPrimaryButton, CompactSecondaryButton, TextField } from './controls';

import type { Profile } from '@/data';
import { t } from '@/i18n';

export type ConnectedApp = 'github' | 'linkedin' | 'instagram' | 'tiktok' | 'portfolio';

const LABELS: Record<ConnectedApp, string> = {
  github: 'GitHub',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  get portfolio() {
    return t('Web');
  },
};

const ORDER: ConnectedApp[] = ['github', 'linkedin', 'instagram', 'tiktok', 'portfolio'];

const SAFE_URL = /^https?:\/\/\S+$/i;

/** Rutas de Instagram que no son un usuario: `instagram.com/p/…` es una publicación. */
const INSTAGRAM_RESERVED = new Set([
  'p',
  'reel',
  'reels',
  'tv',
  'stories',
  'explore',
  'accounts',
  'direct',
  'about',
  'developer',
  'legal',
]);

/**
 * El `@usuario` de un enlace de Instagram o TikTok, o `null` si el enlace no
 * lo dice. Instagram: `instagram.com/usuario`; TikTok: `tiktok.com/@usuario`.
 *
 * Con una expresión y no con `new URL`: el `URL` de React Native no implementa
 * `hostname` ni `pathname` en todos los motores, y en el móvil el usuario no
 * salía (2026-10-30). Los enlaces de compartir traen `?igsh=…&utm_source=qr`.
 */
export function socialHandle(app: ConnectedApp, url: string): string | null {
  const parts = /^https?:\/\/([^/?#]+)\/?([^/?#]*)/i.exec(url.trim());
  if (!parts) return null;
  const host = parts[1].toLowerCase().replace(/^(www\.|m\.)/, '');
  let first: string;
  try {
    first = decodeURIComponent(parts[2]);
  } catch {
    return null;
  }

  if (app === 'instagram' && (host === 'instagram.com' || host === 'instagr.am')) {
    const user = first.replace(/^@/, '');
    return /^[A-Za-z0-9._]{1,30}$/.test(user) && !INSTAGRAM_RESERVED.has(user.toLowerCase())
      ? user
      : null;
  }
  if (app === 'tiktok' && host === 'tiktok.com') {
    const match = /^@([A-Za-z0-9._]{1,24})$/.exec(first);
    return match ? match[1] : null;
  }
  return null;
}

/** Las apps con enlace válido de esa persona, en el orden de la fila. */
export function connectedApps(profile: Profile): { app: ConnectedApp; url: string }[] {
  return ORDER.flatMap((app) => {
    const url = profile.links[app]?.trim();
    return url && SAFE_URL.test(url) ? [{ app, url }] : [];
  });
}

/** Colores de marca, literales a propósito: son de cada app, no de la paleta. */
const BRAND = {
  linkedin: '#0A66C2',
  tiktokCyan: '#25F4EE',
  tiktokRed: '#FE2C55',
} as const;

/** El `@usuario` en el color de su app: el rosa de Instagram, el rojo de TikTok. */
const HANDLE_COLOR: Partial<Record<ConnectedApp, string>> = {
  instagram: '#E1306C',
  tiktok: BRAND.tiktokRed,
};

const TIKTOK_PATH =
  'M16.6 2.5c.3 2.1 1.6 3.6 3.6 3.8v2.9c-1.3 0-2.5-.4-3.6-1.1v6.4a5.6 5.6 0 1 1-5.6-5.6h.4v3a2.7 2.7 0 1 0 2.3 2.6V2.5z';

export function Glyph({
  app,
  color,
  size,
  /** El hueco de dentro del logo de LinkedIn: negro sobre el fondo, blanco en su azul. */
  cutout = '#000000',
  brand = false,
}: {
  app: ConnectedApp;
  color: string;
  size: number;
  cutout?: string;
  /**
   * Con el color de la marca (2026-10-30, decisión del usuario): Instagram en
   * su degradado, TikTok con su cian y su rojo, LinkedIn en su azul. GitHub y
   * la web no tienen color propio y siguen en la tinta (`color`).
   */
  brand?: boolean;
}) {
  if (brand && app === 'linkedin') {
    return <Glyph app="linkedin" color={BRAND.linkedin} cutout="#FFFFFF" size={size} />;
  }
  if (brand && app === 'instagram') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Defs>
          <LinearGradient id="instagram-brand" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor="#FEDA75" />
            <Stop offset="0.25" stopColor="#FA7E1E" />
            <Stop offset="0.5" stopColor="#D62976" />
            <Stop offset="0.75" stopColor="#962FBF" />
            <Stop offset="1" stopColor="#4F5BD5" />
          </LinearGradient>
        </Defs>
        <Rect x={1.5} y={1.5} width={21} height={21} rx={6} fill="url(#instagram-brand)" />
        <Rect
          x={5.5}
          y={5.5}
          width={13}
          height={13}
          rx={3.8}
          stroke="#FFFFFF"
          strokeWidth={1.7}
          fill="none"
        />
        <Circle cx={12} cy={12} r={3.1} stroke="#FFFFFF" strokeWidth={1.7} fill="none" />
        <Circle cx={15.9} cy={8.1} r={0.95} fill="#FFFFFF" />
      </Svg>
    );
  }
  if (brand && app === 'tiktok') {
    // La nota en blanco con sus dos sombras desplazadas, como en fondo oscuro.
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path fill={BRAND.tiktokCyan} d={TIKTOK_PATH} transform="translate(-0.7 -0.7)" />
        <Path fill={BRAND.tiktokRed} d={TIKTOK_PATH} transform="translate(0.7 0.7)" />
        <Path fill="#FFFFFF" d={TIKTOK_PATH} />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {app === 'github' ? (
        <Path
          fill={color}
          d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3"
        />
      ) : null}
      {app === 'linkedin' ? (
        <>
          <Rect x={2} y={2} width={20} height={20} rx={4} fill={color} />
          <Circle cx={7.2} cy={7.4} r={1.5} fill={cutout} />
          <Rect x={5.9} y={9.8} width={2.6} height={8.2} rx={0.4} fill={cutout} />
          <Path
            fill={cutout}
            d="M10.6 9.8h2.5V11c.4-.8 1.4-1.4 2.7-1.4 2.2 0 3 1.4 3 3.6V18h-2.6v-4.2c0-1-.3-1.8-1.3-1.8s-1.7.7-1.7 1.9V18h-2.6z"
          />
        </>
      ) : null}
      {app === 'instagram' ? (
        <>
          <Rect
            x={3}
            y={3}
            width={18}
            height={18}
            rx={5}
            stroke={color}
            strokeWidth={2}
            fill="none"
          />
          <Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={2} fill="none" />
          <Circle cx={17.3} cy={6.7} r={1.2} fill={color} />
        </>
      ) : null}
      {app === 'tiktok' ? <Path fill={color} d={TIKTOK_PATH} /> : null}
      {app === 'portfolio' ? (
        <>
          <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.8} fill="none" />
          <Path
            d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z"
            stroke={color}
            strokeWidth={1.8}
            fill="none"
          />
        </>
      ) : null}
    </Svg>
  );
}

const PLACEHOLDERS: Record<ConnectedApp, string> = {
  github: 'https://github.com/tuusuario',
  linkedin: 'https://linkedin.com/in/tuusuario',
  instagram: 'https://instagram.com/tuusuario',
  tiktok: 'https://tiktok.com/@tuusuario',
  portfolio: 'https://tuportfolio.com',
};

/**
 * Perfil propio (2026-11-01, decisión del usuario): como «Vincular cuentas»,
 * salen los cinco logos; en gris los que no tienen enlace y en su color los que
 * sí. Tocar uno despliega debajo el campo del enlace.
 */
function EditableApps({
  profile,
  onSaveLink,
}: {
  profile: Profile;
  onSaveLink: (app: ConnectedApp, url: string | null) => Promise<void>;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState<ConnectedApp | null>(null);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleApp(app: ConnectedApp) {
    if (saving) return;
    setError(null);
    if (open === app) {
      setOpen(null);
      return;
    }
    setValue(profile.links[app]?.trim() ?? '');
    setOpen(app);
  }

  async function save(app: ConnectedApp, url: string | null) {
    const clean = url?.trim() ?? '';
    if (url !== null && !SAFE_URL.test(clean)) {
      setError(t('El enlace debe empezar por http:// o https://'));
      return;
    }
    if (url !== null && isObjectionable(clean)) {
      setError(t(OBJECTIONABLE_MESSAGE));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSaveLink(app, url === null ? null : clean);
      setOpen(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  const githubLocked = Boolean(profile.githubVerification);

  return (
    <View style={styles.root}>
      <ThemedText type="label" themeColor="textSecondary">
        {t('Redes y enlaces')}
      </ThemedText>
      <View style={styles.row}>
        {ORDER.map((app) => {
          const url = profile.links[app]?.trim();
          const linked = Boolean(url && SAFE_URL.test(url));
          return (
            <View key={app} style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  linked
                    ? t('{v} añadido, editar enlace', { v: LABELS[app] })
                    : t('Añadir {v}', { v: LABELS[app] })
                }
                accessibilityState={{ selected: linked, expanded: open === app }}
                hitSlop={HitSlop.inline}
                onPress={() => toggleApp(app)}
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: open === app ? theme.textSecondary : theme.border,
                    boxShadow: `inset 0px 1px 0px ${theme.glassHighlight}`,
                    opacity: pressed ? Opacity.pressed : 1,
                  },
                ]}>
                <View style={linked ? null : styles.dimmed}>
                  <Glyph
                    app={app}
                    color={linked ? theme.text : theme.textSecondary}
                    size={22}
                    brand={linked}
                  />
                </View>
              </Pressable>
              <ThemedText type="small" themeColor={linked ? 'text' : 'textSecondary'}>
                {LABELS[app]}
              </ThemedText>
            </View>
          );
        })}
      </View>

      {open ? (
        <View
          style={[
            styles.panel,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          {open === 'github' && githubLocked ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t(
                'Tu GitHub está verificado: lo lleva el sello. Para cambiarlo, desvincúlalo abajo en «Vincular cuentas».'
              )}
            </ThemedText>
          ) : (
            <>
              <TextField
                value={value}
                onChangeText={(next) => {
                  setValue(next);
                  setError(null);
                }}
                placeholder={PLACEHOLDERS[open]}
                autoCapitalize="none"
                autoCorrect={false}
                inputMode="url"
                accessibilityLabel={t('Enlace de {v}', { v: LABELS[open] })}
              />
              {error ? (
                <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
                  {error}
                </ThemedText>
              ) : null}
              <CompactPrimaryButton
                label={saving ? t('Guardando…') : t('Guardar')}
                disabled={saving}
                onPress={() => void save(open, value.trim().length > 0 ? value : null)}
              />
              {profile.links[open] ? (
                <CompactSecondaryButton
                  label={t('Quitar enlace')}
                  tone="danger"
                  disabled={saving}
                  onPress={() => void save(open, null)}
                />
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

export function ConnectedApps({
  profile,
  action,
  onSaveLink,
}: {
  profile: Profile;
  /**
   * Junto al rótulo (el lápiz del perfil propio). Con acción el bloque sale
   * aunque no haya enlaces: es justo donde se pulsa para añadirlos.
   */
  action?: ReactNode;
  /**
   * Perfil propio: salen todos los logos (gris si no hay enlace) y tocar uno
   * despliega el campo. Guarda `url`, o `null` para quitar el enlace.
   */
  onSaveLink?: (app: ConnectedApp, url: string | null) => Promise<void>;
}) {
  const theme = useTheme();
  const apps = connectedApps(profile);
  if (onSaveLink) return <EditableApps profile={profile} onSaveLink={onSaveLink} />;
  if (apps.length === 0 && !action) return null;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <ThemedText type="label" themeColor="textSecondary">
          {t('Redes y enlaces')}
        </ThemedText>
        {action}
      </View>
      {apps.length > 0 ? (
        <View style={styles.row}>
          {apps.map(({ app, url }) => {
            const handle = socialHandle(app, url);
            return (
              <Pressable
                key={app}
                accessibilityRole="link"
                accessibilityLabel={
                  handle
                    ? t('Abrir el {v} de {name}, @{handle}', {
                        v: LABELS[app],
                        name: profile.name,
                        handle,
                      })
                    : t('Abrir el {v} de {name}', { v: LABELS[app], name: profile.name })
                }
                hitSlop={HitSlop.inline}
                onPress={() => void Linking.openURL(url).catch(() => undefined)}
                style={({ pressed }) => [
                  styles.button,
                  handle ? styles.pill : null,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.border,
                    boxShadow: `inset 0px 1px 0px ${theme.glassHighlight}`,
                    opacity: pressed ? Opacity.pressed : 1,
                  },
                ]}>
                <Glyph app={app} color={theme.text} size={22} brand />
                {handle ? (
                  <ThemedText
                    type="smallBold"
                    numberOfLines={1}
                    style={[styles.handle, { color: HANDLE_COLOR[app] ?? theme.text }]}>
                    @{handle}
                  </ThemedText>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {t('Añade tu Instagram, TikTok, LinkedIn o web con el lápiz.')}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: Control.minTouch,
  },
  /** Logo + `@usuario`: la misma píldora, a lo ancho. */
  pill: {
    width: 'auto',
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    maxWidth: '100%',
  },
  handle: {
    flexShrink: 1,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  cell: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  dimmed: {
    opacity: Opacity.disabled,
  },
  panel: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radii.medium,
    borderWidth: Stroke.hairline,
  },
  button: {
    width: Control.minTouch + 4,
    height: Control.minTouch + 4,
    borderRadius: Radii.pill,
    borderWidth: Stroke.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
