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
 * - Los logos son dibujos propios y sencillos, en el color de la tinta: la app
 *   no carga marcas de terceros a todo color dentro de su paleta.
 * - Instagram y TikTok llevan además `@usuario` al lado del logo (2026-10-30,
 *   decisión del usuario), sacado del propio enlace. Si el enlace no deja ver
 *   el usuario (una publicación suelta, un enlace acortado), solo el logo.
 */

import { type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Control, HitSlop, Opacity, Radii, Spacing, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { Profile } from '@/data';

export type ConnectedApp = 'github' | 'linkedin' | 'instagram' | 'tiktok' | 'portfolio';

const LABELS: Record<ConnectedApp, string> = {
  github: 'GitHub',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  portfolio: 'Web',
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
 */
export function socialHandle(app: ConnectedApp, url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
  const first = parsed.pathname.split('/').filter(Boolean)[0] ?? '';

  if (app === 'instagram' && (host === 'instagram.com' || host === 'instagr.am')) {
    const user = first.replace(/^@/, '');
    return /^[A-Za-z0-9._]{1,30}$/.test(user) && !INSTAGRAM_RESERVED.has(user.toLowerCase())
      ? user
      : null;
  }
  if (app === 'tiktok' && host === 'tiktok.com') {
    const match = /^@([A-Za-z0-9._]{1,24})$/.exec(decodeURIComponent(first));
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

export function Glyph({
  app,
  color,
  size,
  /** El hueco de dentro del logo de LinkedIn: negro sobre el fondo, blanco en su azul. */
  cutout = '#000000',
}: {
  app: ConnectedApp;
  color: string;
  size: number;
  cutout?: string;
}) {
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
      {app === 'tiktok' ? (
        <Path
          fill={color}
          d="M16.6 2.5c.3 2.1 1.6 3.6 3.6 3.8v2.9c-1.3 0-2.5-.4-3.6-1.1v6.4a5.6 5.6 0 1 1-5.6-5.6h.4v3a2.7 2.7 0 1 0 2.3 2.6V2.5z"
        />
      ) : null}
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

export function ConnectedApps({
  profile,
  action,
}: {
  profile: Profile;
  /**
   * Junto al rótulo (el lápiz del perfil propio). Con acción el bloque sale
   * aunque no haya enlaces: es justo donde se pulsa para añadirlos.
   */
  action?: ReactNode;
}) {
  const theme = useTheme();
  const apps = connectedApps(profile);
  if (apps.length === 0 && !action) return null;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <ThemedText type="label" themeColor="textSecondary">
          Redes y enlaces
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
                    ? `Abrir el ${LABELS[app]} de ${profile.name}, @${handle}`
                    : `Abrir el ${LABELS[app]} de ${profile.name}`
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
                <Glyph app={app} color={theme.text} size={22} />
                {handle ? (
                  <ThemedText type="smallBold" numberOfLines={1} style={styles.handle}>
                    @{handle}
                  </ThemedText>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Añade tu Instagram, TikTok, LinkedIn o web con el lápiz.
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
  button: {
    width: Control.minTouch + 4,
    height: Control.minTouch + 4,
    borderRadius: Radii.pill,
    borderWidth: Stroke.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
